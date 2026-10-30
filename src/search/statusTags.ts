/**
 * Row status tags (Q-047, Q-050) and the empty-results banner. Pure
 * functions: rows, their VoiceOver labels and tests read the same data.
 *
 * Tags per leg: Scheduled = none; Delayed (violet, old time struck);
 * Departed / Arrived (gray, row dimmed); Canceled / Diverted (canceled red,
 * time struck). "Connection at risk" sits at the connecting airport when the
 * live times leave less than the minimum connection.
 */
import { AIRPORTS, localDate, type Flight, type Itinerary } from '@/engine';
import { flightLookupKey, type FlightLookup, type FlightStatus, type Movement } from '@/live';

import { formatDuration, formatTime } from './format';

const MIN = 60_000;

export type LegTagKind = 'delayed' | 'departed' | 'arrived' | 'canceled' | 'diverted';

export interface LegTag {
  kind: LegTagKind;
  /** Visible words, e.g. "Delayed 25m", "Departed". */
  label: string;
  /** What VoiceOver reads, e.g. "Delayed 25 minutes, was 3:10 PM, now 3:35 PM". */
  spoken: string;
}

export interface LegStatusView {
  tag: LegTag | null;
  /** Scheduled departure is struck through (delayed with a new time, canceled, diverted). */
  struck: boolean;
  /** Scheduled departure (UTC ms) and its local text at the leg's origin. */
  scheduledUtc: number;
  scheduledText: string;
  /** New departure for a delay (UTC ms); null otherwise. */
  newUtc: number | null;
  newText: string | null;
}

export interface ConnectionRisk {
  /** Index into Itinerary.connections (between legs i and i+1). */
  index: number;
  airport: string;
  /** Expected minutes on the ground with the live times. */
  layoverMin: number;
  minConnectMin: number;
}

export interface RowStatus {
  legs: LegStatusView[];
  risks: ConnectionRisk[];
  /** First leg departed or arrived: the route can't be caught from the origin. */
  dimmed: boolean;
  /** Any leg canceled or diverted. */
  canceled: boolean;
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

/** "25 minutes", "1 hour 30 minutes", "2 hours". */
export function spokenDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
  const mins = m || !h ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  return [hs, mins].filter(Boolean).join(' ');
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

/**
 * Tag and time display for one leg. `status` undefined = no live data: no
 * tag, never a guess from the schedule (a delayed flight that hasn't left
 * must never read as gone).
 */
export function legStatus(f: Flight, status: FlightStatus | undefined): LegStatusView {
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
    case 'diverted':
      return {
        ...base,
        struck: true,
        tag: { kind: 'diverted', label: 'Diverted', spoken: `Diverted, was ${scheduledText}` },
      };
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
          label: `Delayed ${formatDuration(d.delayMin)}`,
          spoken: `Delayed ${spokenDuration(d.delayMin)}, was ${scheduledText}, now ${newText}`,
        },
      };
    }
  }
}

/** Expected arrival of the inbound leg: actual, else estimated, else scheduled shifted by the departure delay. */
function expectedArrival(f: Flight, status: FlightStatus | undefined, view: LegStatusView): number {
  if (!status) return f.arriveUtc;
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

const GONE: ReadonlySet<LegTagKind> = new Set(['departed', 'arrived']);
const BROKEN: ReadonlySet<LegTagKind> = new Set(['canceled', 'diverted']);

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
): RowStatus {
  const statuses = it.legs.map((l) => byKey[flightLookupKey(legLookup(l.flight))]);
  const legs = it.legs.map((l, i) => legStatus(l.flight, statuses[i]));
  const risks: ConnectionRisk[] = [];
  it.connections.forEach((c, i) => {
    const inbound = legs[i];
    const onward = legs[i + 1];
    if (!onward) return;
    if ((inbound.tag && BROKEN.has(inbound.tag.kind)) || (onward.tag && BROKEN.has(onward.tag.kind))) return;
    if (onward.tag && GONE.has(onward.tag.kind)) return;
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
    ...legs.flatMap((l, i) =>
      l.tag ? [`${it.legs[i].flight.airline} ${it.legs[i].flight.flightNumber}: ${l.tag.spoken}`] : [],
    ),
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

export type ResultsBanner =
  | { kind: 'noFlights'; text: string }
  | { kind: 'hidden'; text: string; action: string; count: number };

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
