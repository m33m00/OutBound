import { endAirports } from './airports';
import { legSeats, routeTier, tierRank } from './seats';
import { addDays, daysBetween, localDate, minutes, zonedToUtc } from './time';
import type {
  Flight,
  FlightDataProvider,
  Itinerary,
  LegSeats,
  SearchOptions,
  SearchOutcome,
  SearchRequest,
} from './types';

const MIN = 60_000;

/** DECISIONS.md "Search" defaults. All adjustable. */
export const DEFAULT_SEARCH_OPTIONS: Omit<SearchOptions, 'now'> = {
  maxStops: 3,
  minConnectSameAirlineMin: 60,
  minConnectSwitchMin: 90,
  maxLayoverMin: 240,
  maxTripMin: 24 * 60,
  limit: 10,
};

export const MAX_DAYS_OUT = 7;

/**
 * Default sort (John, 2026-10-30): departure time, earliest first. Ties go to
 * the earlier arrival, then fewer stops, then best availability (route tier,
 * Q-013), then id so the order is stable. Full routes are not demoted.
 */
export function compareItineraries(a: Itinerary, b: Itinerary): number {
  return (
    a.departUtc - b.departUtc ||
    a.arriveUtc - b.arriveUtc ||
    a.stops - b.stops ||
    tierRank(a.tier) - tierRank(b.tier) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** At most this many routes that already left (by schedule) make the list once it's over the limit. */
export const KEEP_LEFT = 3;

/**
 * The `limit` routes to show, still in departure order. In departure order a
 * plain cut would fill the list with the day's early flights that have already
 * left, so once there are more than `limit`, keep only the KEEP_LEFT routes
 * that left most recently and fill the rest with routes still to leave (more
 * that left fill in if fewer are still to leave). Provisional, not John-decided.
 */
export function pickResults(sorted: Itinerary[], now: number, limit: number): Itinerary[] {
  if (sorted.length <= limit) return sorted;
  const left = sorted.filter((it) => it.departUtc < now);
  const ahead = sorted.filter((it) => it.departUtc >= now);
  const aheadCount = Math.min(ahead.length, Math.max(limit - KEEP_LEFT, limit - left.length));
  const leftCount = Math.min(left.length, limit - aheadCount);
  return [...left.slice(left.length - leftCount), ...ahead.slice(0, aheadCount)];
}

/**
 * Find itineraries from `origin` to `destination` with 0-3 stops, departing
 * on the request's local date. Reads only from the provider. Flights that
 * already left are kept, at the top in time order (Q-047, 2026-10-30); live
 * status grays them.
 */
export async function searchItineraries(
  provider: FlightDataProvider,
  request: SearchRequest,
  options: Partial<SearchOptions> = {},
): Promise<Itinerary[]> {
  const all = await findAll(provider, request, options);
  return pickResults(all, options.now ?? Date.now(), options.limit ?? DEFAULT_SEARCH_OPTIONS.limit);
}

/**
 * Search plus what the app needs when nothing shows (Q-047). When the
 * filters (`options`) leave no routes, the same search runs again with
 * `looseOptions` (the loosest filter values) to tell "the market has no
 * flights that day" (hiddenCount 0) from "your filters hid N routes".
 */
export async function searchRoutes(
  provider: FlightDataProvider,
  request: SearchRequest,
  options: Partial<SearchOptions> = {},
  looseOptions: Partial<SearchOptions> = {},
): Promise<SearchOutcome> {
  const limit = options.limit ?? DEFAULT_SEARCH_OPTIONS.limit;
  const now = options.now ?? Date.now();
  const results = pickResults(await findAll(provider, request, options), now, limit);
  if (results.length) return { results, hiddenCount: 0, hiddenResults: [] };
  const loose = await findAll(provider, request, { ...options, ...looseOptions });
  return { results, hiddenCount: loose.length, hiddenResults: pickResults(loose, now, limit) };
}

/** Every matching itinerary, sorted, before the result limit. */
async function findAll(
  provider: FlightDataProvider,
  request: SearchRequest,
  options: Partial<SearchOptions>,
): Promise<Itinerary[]> {
  const opt: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS, now: Date.now(), ...options };
  const originAirport = provider.getAirport(request.origin);
  if (!originAirport) throw new RangeError(`Unknown airport ${request.origin}`);
  if (!provider.getAirport(request.destination)) {
    throw new RangeError(`Unknown airport ${request.destination}`);
  }

  const daysOut = daysBetween(localDate(opt.now, originAirport.tz), request.date);
  if (daysOut < 0 || daysOut > MAX_DAYS_OUT) {
    throw new RangeError(`Date ${request.date} is not 0-${MAX_DAYS_OUT} days out`);
  }

  // Area toggle on (Q-048): that end searches every airport in its area.
  const origins = new Map(endAirports(request.origin, !!request.originArea));
  const destinations = new Map(endAirports(request.destination, !!request.destinationArea));
  // Intermediate stops never use an origin- or destination-end airport.
  const ends = new Set([...origins.keys(), ...destinations.keys()]);

  // One fetch per airport, wide enough for the date plus a full-length trip.
  const windowStart = zonedToUtc(addDays(request.date, -1), '00:00', originAirport.tz);
  const windowEnd = zonedToUtc(addDays(request.date, 3), '00:00', originAirport.tz);
  const departures = new Map<string, Promise<Flight[]>>();
  const departuresFrom = (code: string) => {
    let p = departures.get(code);
    if (!p) {
      p = provider.getDepartures(code, windowStart, windowEnd);
      departures.set(code, p);
    }
    return p;
  };

  const found: Flight[][] = [];

  async function extend(path: Flight[], visited: Set<string>): Promise<void> {
    const last = path[path.length - 1];
    if (destinations.has(last.to)) {
      found.push(path);
      return;
    }
    if (path.length > opt.maxStops) return;
    for (const next of await departuresFrom(last.to)) {
      const layover = (next.departUtc - last.arriveUtc) / MIN;
      const minConnect =
        next.airline === last.airline ? opt.minConnectSameAirlineMin : opt.minConnectSwitchMin;
      if (layover < minConnect || layover > opt.maxLayoverMin) continue;
      if (visited.has(next.to)) continue;
      if (ends.has(next.to) && !destinations.has(next.to)) continue;
      if ((next.arriveUtc - path[0].departUtc) / MIN > opt.maxTripMin) continue;
      await extend([...path, next], new Set(visited).add(next.to));
    }
  }

  for (const code of origins.keys()) {
    const airport = provider.getAirport(code);
    if (!airport) continue;
    for (const f of await departuresFrom(code)) {
      if (localDate(f.departUtc, airport.tz) !== request.date) continue;
      if (f.to === code || (ends.has(f.to) && !destinations.has(f.to))) continue;
      if ((f.arriveUtc - f.departUtc) / MIN > opt.maxTripMin) continue;
      await extend([f], new Set([code, f.to]));
    }
  }

  const seats = new Map<string, Promise<LegSeats>>();
  const seatsFor = (id: string) => {
    let p = seats.get(id);
    if (!p) {
      p = provider.getSeatReports(id).then(legSeats);
      seats.set(id, p);
    }
    return p;
  };

  const itineraries = await Promise.all(
    found.map(async (flights): Promise<Itinerary> => {
      const legSeatList = await Promise.all(flights.map((f) => seatsFor(f.id)));
      const first = flights[0];
      const last = flights[flights.length - 1];
      const tier = routeTier(legSeatList);
      return {
        id: flights.map((f) => f.id).join('+'),
        pathKey: [first.from, ...flights.map((f) => f.to)].join('>'),
        legs: flights.map((flight, i) => ({ flight, seats: legSeatList[i] })),
        stops: flights.length - 1,
        connections: flights.slice(1).map((f, i) => ({
          airport: f.from,
          layoverMin: minutes(f.departUtc - flights[i].arriveUtc),
          sameAirline: f.airline === flights[i].airline,
        })),
        departUtc: first.departUtc,
        arriveUtc: last.arriveUtc,
        totalMin: minutes(last.arriveUtc - first.departUtc),
        requestedOrigin: request.origin,
        requestedDestination: request.destination,
        origin: first.from,
        destination: last.to,
        originTransferMin: origins.get(first.from) ?? null,
        destinationTransferMin: destinations.get(last.to) ?? null,
        tier,
        isFull: tier === 'full',
      };
    }),
  );

  return itineraries.sort(compareItineraries);
}
