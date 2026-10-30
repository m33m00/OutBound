/**
 * Saved routes (Q-043, John 2026-10-30: option A). Saved from a route in
 * Search, kept on the phone, no limit. Opening one runs that day's search
 * again, so seats and times are current, then opens the same flights if
 * they're still in the results.
 */
import { AIRPORTS, localDate, type Itinerary, type SearchRequest } from '@/engine';
import { shortDate } from '@/search/dates';
import { formatTime } from '@/search/format';

export const SAVED_ROUTES_KEY = 'outbound.savedRoutes.v1';

/** One flight of a saved route: enough to show it and to find it again. */
export interface SavedLeg {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departUtc: number;
  arriveUtc: number;
}

export interface SavedRoute {
  /** Search day plus the flights, so one route saves once. */
  key: string;
  /** The search it came from (airports, day and area choices). */
  request: SearchRequest;
  legs: SavedLeg[];
  savedAt: number;
}

/** "AA1234:DFW-ORD+AA88:ORD-LAX": the same flights on any search. */
export function routeSignature(legs: readonly Pick<SavedLeg, 'airline' | 'flightNumber' | 'from' | 'to'>[]): string {
  return legs.map((l) => `${l.airline}${l.flightNumber}:${l.from}-${l.to}`).join('+');
}

const itineraryLegs = (it: Itinerary): SavedLeg[] =>
  it.legs.map(({ flight: f }) => ({
    airline: f.airline,
    flightNumber: f.flightNumber,
    from: f.from,
    to: f.to,
    departUtc: f.departUtc,
    arriveUtc: f.arriveUtc,
  }));

export const savedKey = (it: Itinerary, date: string) => `${date}|${routeSignature(itineraryLegs(it))}`;

export function savedRouteFrom(it: Itinerary, request: SearchRequest, now: number): SavedRoute {
  return { key: savedKey(it, request.date), request: { ...request }, legs: itineraryLegs(it), savedAt: now };
}

/** Saved list with the route added (once). */
export function addSaved(list: readonly SavedRoute[], route: SavedRoute): SavedRoute[] {
  return list.some((r) => r.key === route.key) ? [...list] : [...list, route];
}

export const removeSaved = (list: readonly SavedRoute[], key: string): SavedRoute[] =>
  list.filter((r) => r.key !== key);

const known = (v: unknown): v is string => typeof v === 'string' && v in AIRPORTS;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function parseLeg(raw: unknown): SavedLeg | null {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof l.airline !== 'string' || typeof l.flightNumber !== 'string') return null;
  if (!known(l.from) || !known(l.to) || !isNum(l.departUtc) || !isNum(l.arriveUtc)) return null;
  return { airline: l.airline, flightNumber: l.flightNumber, from: l.from, to: l.to, departUtc: l.departUtc, arriveUtc: l.arriveUtc };
}

function parseRoute(raw: unknown): SavedRoute | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const q = (o.request && typeof o.request === 'object' ? o.request : {}) as Record<string, unknown>;
  if (!known(q.origin) || !known(q.destination) || !isDate(q.date) || !Array.isArray(o.legs)) return null;
  const legs = o.legs.map(parseLeg);
  if (!legs.length || legs.some((l) => l == null)) return null;
  const clean = legs as SavedLeg[];
  const request: SearchRequest = {
    origin: q.origin,
    destination: q.destination,
    date: q.date,
    originArea: q.originArea === true,
    destinationArea: q.destinationArea === true,
  };
  return { key: `${q.date}|${routeSignature(clean)}`, request, legs: clean, savedAt: isNum(o.savedAt) ? o.savedAt : 0 };
}

/** Saved JSON (or anything) -> valid saved routes; bad entries and repeats are dropped. */
export function parseSavedRoutes(raw: unknown): SavedRoute[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseRoute).reduce<SavedRoute[]>((list, r) => (r ? addSaved(list, r) : list), []);
}

/** The route's search day is over at its origin. */
export function isPast(route: SavedRoute, now: number): boolean {
  return route.request.date < localDate(now, AIRPORTS[route.request.origin].tz);
}

/** Coming trips first by departure, then days that have passed (latest first). */
export function sortSaved(list: readonly SavedRoute[], now: number): SavedRoute[] {
  return [...list].sort((a, b) => {
    const pa = isPast(a, now);
    const pb = isPast(b, now);
    if (pa !== pb) return pa ? 1 : -1;
    const d = a.legs[0].departUtc - b.legs[0].departUtc;
    return pa ? -d : d;
  });
}

/**
 * The search to run when a saved route is opened: its own day, or today
 * once that day has passed (search only covers today through 7 days out).
 */
export function openRequest(route: SavedRoute, now: number): SearchRequest {
  if (!isPast(route, now)) return { ...route.request };
  return { ...route.request, date: localDate(now, AIRPORTS[route.request.origin].tz) };
}

/** The same flights in fresh results, if they're still there. */
export function findSaved(results: readonly Itinerary[], route: SavedRoute): Itinerary | undefined {
  const sig = routeSignature(route.legs);
  return results.find((it) => routeSignature(itineraryLegs(it)) === sig);
}

/** "DAL → PHX → LAX". */
export const savedRouteTitle = (route: SavedRoute) =>
  [route.legs[0].from, ...route.legs.map((l) => l.to)].join(' → ');

/** "Thu, Oct 30 · 7:05 AM – 1:20 PM", times local at each end. */
export function savedRouteWhen(route: SavedRoute): string {
  const first = route.legs[0];
  const last = route.legs[route.legs.length - 1];
  const dep = formatTime(first.departUtc, AIRPORTS[first.from].tz);
  const arr = formatTime(last.arriveUtc, AIRPORTS[last.to].tz);
  return `${shortDate(route.request.date)} · ${dep} – ${arr}`;
}

/** "AA 1234, AA 88". Airline codes only, never names or logos. */
export const savedRouteFlights = (route: SavedRoute) =>
  route.legs.map((l) => `${l.airline} ${l.flightNumber}`).join(', ');

export type ReopenOutcome =
  | { kind: 'open'; id: string; hidden: boolean }
  | { kind: 'note'; text: string };

/**
 * What Search does once a saved route's search is back: open the same
 * flights (from the routes your filters hid if need be, as Show Them does),
 * or show the list with a note. A day that passed opens today's list with a
 * note, never a route from another day.
 */
export function reopenOutcome(
  results: { results: readonly Itinerary[]; hiddenResults: readonly Itinerary[] },
  route: SavedRoute,
  past: boolean,
): ReopenOutcome {
  if (past) return { kind: 'note', text: 'Your saved day has passed, so this is today’s search.' };
  const hit = findSaved(results.results, route);
  if (hit) return { kind: 'open', id: hit.id, hidden: false };
  const hidden = findSaved(results.hiddenResults, route);
  if (hidden) return { kind: 'open', id: hidden.id, hidden: true };
  return { kind: 'note', text: 'Your saved flights aren’t in this search anymore. Here’s what’s flying that day.' };
}
