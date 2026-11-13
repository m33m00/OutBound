/**
 * Row status tags (Q-047, Q-050) and the empty-results banner. Pure
 * functions: rows, their VoiceOver labels and tests read the same data.
 *
 * Tags per leg: Scheduled = none; Delayed ("25m late", violet, old time struck);
 * Departed / Arrived (gray, row dimmed); Canceled (canceled red, time
 * struck). Diverted (violet caution, never struck, John 2026-11-01): a
 * diverted flight still goes on to its destination late, so it names where it
 * diverted when the data says, keeps its times, and puts the onward
 * connection at risk. "Connection at risk" sits at the connecting airport
 * when the live times leave less than the minimum connection.
 */
import { AIRPORTS, localDate, type Flight, type Itinerary } from '@/engine';
import { flightLookupKey, type FlightLookup, type FlightStatus, type Movement } from '@/live';
import type { RouteLine } from '@/map';

import { formatDuration, formatTime, spokenDuration } from './format';

export { spokenDuration };

const MIN = 60_000;

export type LegTagKind = 'delayed' | 'departed' | 'arrived' | 'canceled' | 'diverted';

export interface LegTag {
  kind: LegTagKind;
  /** Visible words, e.g. "25m late", "Departed". */
  label: string;
  /** What VoiceOver reads, e.g. "Delayed 25 minutes, was 3:10 PM, now 3:35 PM". */
  spoken: string;
}

export interface LegStatusView {
  tag: LegTag | null;
  /** Scheduled departure is struck through (delayed with a new time, canceled). */
  struck: boolean;
  /** Where a diverted flight landed instead, when the live data says (it differs from the planned arrival). */
  divertedTo?: string | null;
  /** Scheduled departure (UTC ms) and its local text at the leg's origin. */
  scheduledUtc: number;
  scheduledText: string;
  /** New departure for a delay (UTC ms); null otherwise. */
  newUtc: number | null;
  newText: string | null;
  /** Expected arrival when live data moves it 5+ min (actual, estimated, or the departure delay carried
   * through); absent otherwise and for a canceled or diverted leg (John, 2026-11-02). */
  arrival?: { newUtc: number; newText: string };
}

export interface ConnectionRisk {
  /** Index into Itinerary.connections (between legs i and i+1). */
  index: number;
  airport: string;
  /** The inbound flight diverted: its new arrival isn't known yet, so layoverMin is a guess-free NaN. */
  diverted?: boolean;
  /** Expected minutes on the ground with the live times. */
  layoverMin: number;
  minConnectMin: number;
}

export interface RowStatus {
  legs: LegStatusView[];
  risks: ConnectionRisk[];
  /** First leg departed or arrived: the route can't be caught from the origin. */
  dimmed: boolean;
  /** Any leg canceled (a diversion isn't a cancellation, John 2026-11-01). */
  canceled: boolean;
  /** A leg diverted: the route's arrival time is pending until the flight goes on. */
  arrivalPending?: boolean;
  /** Spoken parts for the row label, in leg order. */
  spoken: string[];
  /** Expected arrival at the end of the route when live status moves it 5+ min (design round 25). */
  arrival?: { newUtc: number; newText: string };
}

export interface ConnectionMins {
  minConnectSameAirlineMin: number;
  minConnectSwitchMin: number;
}

const tz = (code: string) => AIRPORTS[code]?.tz ?? 'UTC';
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const firstValid = (...v: number[]) => v.find((x) => Number.isFinite(x)) ?? NaN;

/** Status lookup for one leg: local departure date at its origin. */
export function legLookup(f: Flight): FlightLookup {
  return {
    airline: f.airline,
    flightNumber: f.flightNumber,
    date: localDate(f.departUtc, tz(f.from)),
    from: f.from,
    departUtc: f.departUtc,
    arriveUtc: f.arriveUtc,
  };
}

/** One lookup per distinct flight across all shown itineraries. */
export function statusLookups(itineraries: readonly Itinerary[]): FlightLookup[] {
  const seen = new Map<string, FlightLookup>();
  for (const it of itineraries) {
    for (const leg of it.legs) {
      const l = legLookup(leg.flight);
      const k = flightLookupKey(l);
      if (!seen.has(k)) seen.set(k, l);
    }
  }
  return [...seen.values()];
}

/** New departure time for a delayed leg: actual, else estimated, else scheduled + delay. */
function delayedDeparture(f: Flight, dep: Movement): { newUtc: number; delayMin: number } | null {
  const scheduled = firstValid(ms(dep.scheduledUtc), f.departUtc);
  let newUtc = firstValid(ms(dep.actualUtc), ms(dep.estimatedUtc));
  if (!Number.isFinite(newUtc) && dep.delayMin != null) newUtc = scheduled + dep.delayMin * MIN;
  if (!Number.isFinite(newUtc)) return null;
  const delayMin = Math.round((newUtc - scheduled) / MIN);
  return delayMin > 0 ? { newUtc, delayMin } : null;
}

/** An hour past its expected landing, a flight the data still lists as on its way has landed. */
export const SETTLED_AFTER_MIN = 60;

/**
 * Brings a leg's live state up to what the clock and its own times already say (round 192, John: "Why does the
 * Arrived pill show for the 2nd leg but the first leg it doesn't say Arrived either?"). A feed can stop updating
 * a flight once it's in, so: an actual landing time that has passed is Arrived, an actual takeoff that has
 * passed is at least Departed, and a flight an hour past its expected landing is Arrived. Never from the
 * schedule alone before then, so a delayed flight that hasn't left never reads as gone. Canceled and diverted
 * stay as they are.
 */
export function settleByClock(f: Flight, status: FlightStatus | undefined, now: number | undefined): FlightStatus | undefined {
  if (!status || now == null || !Number.isFinite(now)) return status;
  if (status.state === 'arrived' || status.state === 'canceled' || status.state === 'diverted') return status;
  const landed = ms(status.arrival.actualUtc);
  if (Number.isFinite(landed) && landed <= now) return { ...status, state: 'arrived' };
  if (expectedLanding(f, status) + SETTLED_AFTER_MIN * MIN <= now) return { ...status, state: 'arrived' };
  if (status.state === 'departed') return status;
  const tookOff = ms(status.departure.actualUtc);
  if (Number.isFinite(tookOff) && tookOff <= now) return { ...status, state: 'departed' };
  return status;
}

/** When a leg should be on the ground: actual, else estimated, else scheduled moved by any departure delay. */
function expectedLanding(f: Flight, status: FlightStatus): number {
  const a = firstValid(ms(status.arrival.actualUtc), ms(status.arrival.estimatedUtc));
  if (Number.isFinite(a)) return a;
  const dep = status.state === 'delayed' ? delayedDeparture(f, status.departure) : null;
  return dep ? f.arriveUtc + (dep.newUtc - f.departUtc) : f.arriveUtc;
}

/**
 * Tag and time display for one leg. `status` undefined = no live data: no
 * tag, never a guess from the schedule (a delayed flight that hasn't left
 * must never read as gone).
 */
export function legStatus(f: Flight, raw: FlightStatus | undefined, now?: number): LegStatusView {
  const status = settleByClock(f, raw, now);
  const scheduledUtc = f.departUtc;
  const scheduledText = formatTime(scheduledUtc, tz(f.from));
  const base: LegStatusView = { tag: null, struck: false, scheduledUtc, scheduledText, newUtc: null, newText: null };
  if (!status) return base;
  switch (status.state) {
    case 'scheduled':
      return base;
    case 'departed':
      return { ...base, tag: { kind: 'departed', label: 'Departed', spoken: 'Departed' } };
    case 'arrived':
      return { ...base, tag: { kind: 'arrived', label: 'Arrived', spoken: 'Arrived' } };
    case 'canceled':
      return {
        ...base,
        struck: true,
        tag: { kind: 'canceled', label: 'Canceled', spoken: `Canceled, was ${scheduledText}` },
      };
    case 'diverted': {
      // The arrival side names the airport it landed at when the provider moved it (John, 2026-11-01).
      const landed = status.arrival.airport?.toUpperCase() ?? null;
      const divertedTo = landed && landed !== f.to ? landed : null;
      const label = divertedTo ? `Diverted to ${divertedTo}` : 'Diverted';
      return {
        ...base,
        divertedTo,
        tag: { kind: 'diverted', label, spoken: `${label}, continuing to ${f.to}, new arrival time pending` },
      };
    }
    case 'delayed': {
      const d = delayedDeparture(f, status.departure);
      if (!d) return { ...base, tag: { kind: 'delayed', label: 'Delayed', spoken: 'Delayed' } };
      const newText = formatTime(d.newUtc, tz(f.from));
      return {
        ...base,
        struck: true,
        newUtc: d.newUtc,
        newText,
        tag: {
          kind: 'delayed',
          // "25m late" reads at a glance and fits even a 2-stop ticket's short legs (round 157, John: "+25m
          // doesn't really say much"); the same words as the flight sheet's.
          label: `${formatDuration(d.delayMin)} late`,
          spoken: `Delayed ${spokenDuration(d.delayMin)}, was ${scheduledText}, now ${newText}`,
        },
      };
    }
  }
}

/** Expected arrival of the inbound leg: actual, else estimated, else scheduled shifted by the departure delay. */
function expectedArrival(f: Flight, status: FlightStatus | undefined, view: LegStatusView): number {
  if (!status) return f.arriveUtc;
  // A diverted flight's arrival times are for where it landed, not where it's going: unknown.
  if (status.state === 'diverted') return NaN;
  const a = firstValid(ms(status.arrival.actualUtc), ms(status.arrival.estimatedUtc));
  if (Number.isFinite(a)) return a;
  return view.newUtc != null ? f.arriveUtc + (view.newUtc - f.departUtc) : f.arriveUtc;
}

/** Expected departure of the outbound leg: delayed time, else estimated, else scheduled. */
function expectedDeparture(f: Flight, status: FlightStatus | undefined, view: LegStatusView): number {
  if (view.newUtc != null) return view.newUtc;
  return firstValid(ms(status?.departure.estimatedUtc), f.departUtc);
}

/** Under this, an arrival counts as on time (matches "On time" in the flight sheet). */
const ARRIVAL_SHIFT_MIN = 5;

function withLegArrival(f: Flight, status: FlightStatus | undefined, view: LegStatusView): LegStatusView {
  if (!status || view.tag?.kind === 'canceled') return view;
  const expected = expectedArrival(f, status, view);
  if (!Number.isFinite(expected) || Math.abs(expected - f.arriveUtc) < ARRIVAL_SHIFT_MIN * MIN) return view;
  return { ...view, arrival: { newUtc: expected, newText: formatTime(expected, tz(f.to)) } };
}

const GONE: ReadonlySet<LegTagKind> = new Set(['departed', 'arrived']);

/** Pills that mean a leg can't be boarded any more. */
const UNBOARDABLE: ReadonlySet<LegTagKind> = new Set(['canceled', 'departed', 'arrived', 'diverted']);

/**
 * The hidden legs whose loads can still be requested (round 192, John: "If a flight is canceled there should be
 * no way to request the loads for that flight. It would be a waste of a token"). The same goes for a leg that has
 * left, landed or diverted: there's no seat on it to get.
 */
export function requestableLegs(locked: readonly number[], status: RowStatus | undefined): number[] {
  return locked.filter((i) => {
    const kind = status?.legs[i]?.tag?.kind;
    return !kind || !UNBOARDABLE.has(kind);
  });
}
const BROKEN: ReadonlySet<LegTagKind> = new Set(['canceled']);

/**
 * An earlier leg never reads as less far along than a later one (round 192, John: "make sure ... these pills
 * make logical sense"). When a later leg has left, an earlier leg with no news of its own (on time, or
 * departed) that was due to land by now reads Arrived, and one that was due to leave by now reads at least
 * Departed. A delayed, canceled or diverted earlier leg keeps its own pill: that's a real missed connection.
 */
function inLegOrder(
  it: Itinerary,
  statuses: (FlightStatus | undefined)[],
  now: number | undefined,
): (FlightStatus | undefined)[] {
  if (now == null || !Number.isFinite(now)) return statuses;
  const out = [...statuses];
  let laterGone = false;
  for (let i = out.length - 1; i >= 0; i--) {
    const s = out[i];
    const f = it.legs[i].flight;
    if (laterGone && s && (s.state === 'scheduled' || s.state === 'departed')) {
      if (expectedLanding(f, s) <= now) out[i] = { ...s, state: 'arrived' };
      else if (s.state === 'scheduled' && firstValid(ms(s.departure.estimatedUtc), f.departUtc) <= now)
        out[i] = { ...s, state: 'departed' };
    }
    const st = out[i]?.state;
    if (st === 'departed' || st === 'arrived') laterGone = true;
  }
  return out;
}

/**
 * Tags for a whole row. A connection is at risk when the live times leave
 * less than the minimum connection (same airline / switching) and less than
 * the schedule did, so it only ever comes from real live times. Checked only while the onward leg hasn't departed; a
 * canceled or diverted leg on either side shows that tag only.
 */
export function rowStatus(
  it: Itinerary,
  byKey: Readonly<Record<string, FlightStatus>>,
  mins: ConnectionMins,
  now?: number,
): RowStatus {
  const statuses = inLegOrder(
    it,
    it.legs.map((l) => settleByClock(l.flight, byKey[flightLookupKey(legLookup(l.flight))], now)),
    now,
  );
  // Each leg's own new arrival, so its box can show both times (John, 2026-11-02).
  const legs = it.legs.map((l, i) => withLegArrival(l.flight, statuses[i], legStatus(l.flight, statuses[i])));
  const risks: ConnectionRisk[] = [];
  it.connections.forEach((c, i) => {
    const inbound = legs[i];
    const onward = legs[i + 1];
    if (!onward) return;
    if ((inbound.tag && BROKEN.has(inbound.tag.kind)) || (onward.tag && BROKEN.has(onward.tag.kind))) return;
    if (onward.tag && (GONE.has(onward.tag.kind) || onward.tag.kind === 'diverted')) return;
    const minFor = c.sameAirline ? mins.minConnectSameAirlineMin : mins.minConnectSwitchMin;
    // The inbound diverted: it gets in late at a time nobody knows yet, so the connection is at risk.
    if (inbound.tag?.kind === 'diverted') {
      risks.push({ index: i, airport: c.airport, layoverMin: NaN, minConnectMin: minFor, diverted: true });
      return;
    }
    const inFlight = it.legs[i].flight;
    const outFlight = it.legs[i + 1].flight;
    const layoverMin = Math.round(
      (expectedDeparture(outFlight, statuses[i + 1], onward) - expectedArrival(inFlight, statuses[i], inbound)) / MIN,
    );
    const minConnectMin = c.sameAirline ? mins.minConnectSameAirlineMin : mins.minConnectSwitchMin;
    if (layoverMin < minConnectMin && layoverMin < c.layoverMin) {
      risks.push({ index: i, airport: c.airport, layoverMin, minConnectMin });
    }
  });
  const first = legs[0]?.tag;
  const spoken = [
    ...legs.flatMap((l, i) => (l.tag ? [`${it.legs[i].flight.airline} ${it.legs[i].flight.flightNumber}: ${l.tag.spoken}`] : [])),
    ...risks.map((r) => `Connection at risk at ${r.airport}`),
  ];
  const last = it.legs[it.legs.length - 1]?.flight;
  const lastStatus = statuses[statuses.length - 1];
  const expected = last && lastStatus ? expectedArrival(last, lastStatus, legs[legs.length - 1]) : NaN;
  const arrival =
    Number.isFinite(expected) && Math.abs(expected - last.arriveUtc) >= ARRIVAL_SHIFT_MIN * MIN
      ? { newUtc: expected, newText: formatTime(expected, tz(last.to)) }
      : undefined;
  return {
    legs,
    risks,
    ...(arrival ? { arrival } : {}),
    dimmed: first != null && GONE.has(first.kind),
    canceled: legs.some((l) => l.tag != null && BROKEN.has(l.tag.kind)),
    ...(legs.some((l) => l.tag?.kind === 'diverted') ? { arrivalPending: true } : {}),
    spoken,
  };
}

/**
 * Routes whose first leg has left (live Departed / Arrived) go to the top,
 * grayed, keeping departure order inside each group (John, 2026-10-30). The
 * results list and its scroll-to-row both read this order.
 */
export function departedFirst<T extends { id: string }>(results: T[], statuses?: Record<string, RowStatus>): T[] {
  if (!statuses) return results;
  const gone = results.filter((it) => statuses[it.id]?.dimmed);
  if (!gone.length || gone.length === results.length) return results;
  return [...gone, ...results.filter((it) => !statuses[it.id]?.dimmed)];
}

// ---------------------------------------------------------------- empty results (Q-047)

export type ResultsBanner = { kind: 'noFlights'; text: string } | { kind: 'hidden'; text: string; action: string; count: number };

/**
 * Banner for a finished search with no routes: "No Flights Found on Selected
 * Date" when the market has none, else "{N} routes hidden by your filters".
 * Null when there are routes to show.
 */
export function resultsBanner(out: { results: readonly unknown[]; hiddenCount: number }): ResultsBanner | null {
  if (out.results.length) return null;
  if (!out.hiddenCount) return { kind: 'noFlights', text: 'No Flights Found on Selected Date' };
  const n = out.hiddenCount;
  return { kind: 'hidden', text: `${n} ${n === 1 ? 'route' : 'routes'} hidden by your filters`, action: 'Show Them', count: n };
}

const brokenLeg = (v: LegStatusView | undefined) => v?.tag?.kind === 'canceled' || v?.tag?.kind === 'diverted';

/**
 * Minutes on the ground at connection `i` with the times the card shows: the inbound's new arrival
 * and the onward flight's new departure when they moved (John, 2026-11-02: "connection time should
 * adjust to a delay"). Negative when the onward flight now leaves before the inbound lands. The
 * schedule when there's no live data, or a leg on either side is canceled or diverted.
 */
export function liveLayoverMin(it: Itinerary, status: RowStatus | undefined, i: number): number {
  const c = it.connections[i];
  const inbound = it.legs[i]?.flight;
  const onward = it.legs[i + 1]?.flight;
  if (!c || !inbound || !onward) return NaN;
  const inV = status?.legs[i];
  const outV = status?.legs[i + 1];
  if (!status || brokenLeg(inV) || brokenLeg(outV)) return c.layoverMin;
  const arrive = inV?.arrival?.newUtc ?? inbound.arriveUtc;
  const depart = outV?.newUtc ?? onward.departUtc;
  return Math.round((depart - arrive) / MIN);
}

/** The whole trip's minutes with the times shown (new first departure to new last arrival); the schedule otherwise. */
export function liveTotalMin(it: Itinerary, status: RowStatus | undefined): number {
  const first = it.legs[0]?.flight;
  const last = it.legs[it.legs.length - 1]?.flight;
  if (!status || !first || !last || status.canceled || status.arrivalPending) return it.totalMin;
  const depart = status.legs[0]?.newUtc ?? first.departUtc;
  const arrive = status.arrival?.newUtc ?? last.arriveUtc;
  return Math.round((arrive - depart) / MIN);
}

/**
 * The map's copy of a route with each canceled leg flagged (round 199, John: "Route map should indicate in
 * some way this leg is canceled"). Only a leg whose own live tag is Canceled changes; the rest stay as they
 * are. Returns the same object when nothing is canceled, so the map doesn't redraw for nothing.
 */
export function markCanceledLegs(route: RouteLine, status: RowStatus | undefined): RouteLine {
  if (!status?.legs.some((l) => l.tag?.kind === 'canceled')) return route;
  return {
    ...route,
    legs: route.legs.map((leg, i) => (status.legs[i]?.tag?.kind === 'canceled' ? { ...leg, canceled: true } : leg)),
  };
}
