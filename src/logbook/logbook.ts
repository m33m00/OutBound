/**
 * Logbook (John 2026-10-30, option A): flights you've taken, kept on this
 * phone only. Added by scanning a boarding pass, picking a screenshot of
 * one, or typing it in. Totals up top, then flights by month.
 */
import { addDays, localDate } from '@/engine';
import { shortDate } from '@/search/dates';
import { distanceKm } from '@/search/leaveBy';

import { AIRPORT_COORDS } from './airportCoords';
import type { PassLeg } from './bcbp';

export const LOGBOOK_KEY = 'outbound.logbook.v1';

export type LogSource = 'scan' | 'photo' | 'manual';

export interface LoggedFlight {
  /** Day plus flight, so the same pass scanned twice logs once. */
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  /** "YYYY-MM-DD", the flight's day. */
  date: string;
  seat?: string;
  source: LogSource;
  addedAt: number;
}

const KM_TO_MI = 0.621371;

export const loggedId = (f: Pick<LoggedFlight, 'date' | 'airline' | 'flightNumber' | 'from' | 'to'>) =>
  `${f.date}|${f.airline}${f.flightNumber}:${f.from}-${f.to}`;

export function loggedFrom(leg: PassLeg, source: LogSource, now: number): LoggedFlight {
  const f: LoggedFlight = {
    id: loggedId(leg),
    airline: leg.airline,
    flightNumber: leg.flightNumber,
    from: leg.from,
    to: leg.to,
    date: leg.date,
    source,
    addedAt: now,
  };
  if (leg.seat) f.seat = leg.seat;
  return f;
}

/** The flight sheet offers Add to Logbook from this long before departure (round 63). */
export const LOG_FROM_MS = 2 * 60 * 60 * 1000;

/** A searched flight as a logbook entry, on its day at the departure airport. */
export function loggedFromFlight(
  f: { airline: string; flightNumber: string; from: string; to: string; departUtc: number },
  tz: string,
  now: number,
): LoggedFlight {
  return loggedFrom({ airline: f.airline, flightNumber: f.flightNumber, from: f.from, to: f.to, date: localDate(f.departUtc, tz) }, 'manual', now);
}

/** Logbook with these flights added; one already there stays as it was. */
export function addLogged(list: readonly LoggedFlight[], flights: readonly LoggedFlight[]): LoggedFlight[] {
  const next = [...list];
  for (const f of flights) if (!next.some((g) => g.id === f.id)) next.push(f);
  return next;
}

/** Logbook with one flight swapped for its fixed version, in the same place. */
export const replaceLogged = (list: readonly LoggedFlight[], id: string, flight: LoggedFlight): LoggedFlight[] =>
  list.filter((f) => f.id === id || f.id !== flight.id).map((f) => (f.id === id ? flight : f));

export const removeLogged = (list: readonly LoggedFlight[], id: string): LoggedFlight[] =>
  list.filter((f) => f.id !== id);

/** Great-circle miles, or null when an airport isn't in the table. */
export function flightMiles(from: string, to: string): number | null {
  const a = AIRPORT_COORDS[from];
  const b = AIRPORT_COORDS[to];
  if (!a || !b) return null;
  return Math.round(distanceKm(a[0], a[1], b[0], b[1]) * KM_TO_MI);
}

export interface LogbookTotals {
  flights: number;
  miles: number;
  airports: number;
}

export function logbookTotals(list: readonly LoggedFlight[]): LogbookTotals {
  const airports = new Set<string>();
  let miles = 0;
  for (const f of list) {
    airports.add(f.from);
    airports.add(f.to);
    miles += flightMiles(f.from, f.to) ?? 0;
  }
  return { flights: list.length, miles, airports: airports.size };
}

export interface LogbookHighlights {
  /** The airport in the most logged flights, from or to, with that count. */
  topAirport: { code: string; flights: number } | null;
  /** The longest logged flight by straight-line miles. */
  longest: { from: string; to: string; miles: number } | null;
}

/**
 * One airport and one flight worth calling out (round 62). Ties go to the
 * airport or flight logged first. Shown once there are two flights or more.
 */
export function logbookHighlights(list: readonly LoggedFlight[]): LogbookHighlights {
  if (list.length < 2) return { topAirport: null, longest: null };
  const counts = new Map<string, number>();
  let longest: LogbookHighlights['longest'] = null;
  for (const f of list) {
    for (const code of [f.from, f.to]) counts.set(code, (counts.get(code) ?? 0) + 1);
    const miles = flightMiles(f.from, f.to);
    if (miles != null && (!longest || miles > longest.miles)) longest = { from: f.from, to: f.to, miles };
  }
  let topAirport: LogbookHighlights['topAirport'] = null;
  for (const [code, n] of counts) if (!topAirport || n > topAirport.flights) topAirport = { code, flights: n };
  // An airport in every flight but one each is no highlight.
  if (topAirport && topAirport.flights < 2) topAirport = null;
  return { topAirport, longest };
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-10-30" -> "October 2026". */
export const monthTitle = (date: string) => `${LONG_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

export interface LogbookMonth {
  title: string;
  flights: LoggedFlight[];
}

/** Newest first, grouped by month. Same day: the one added last on top. */
export function logbookMonths(list: readonly LoggedFlight[]): LogbookMonth[] {
  const sorted = [...list].sort((a, b) => (a.date === b.date ? b.addedAt - a.addedAt : a.date < b.date ? 1 : -1));
  const months: LogbookMonth[] = [];
  for (const f of sorted) {
    const title = monthTitle(f.date);
    const last = months[months.length - 1];
    if (last?.title === title) last.flights.push(f);
    else months.push({ title, flights: [f] });
  }
  return months;
}

/** "Today", "Yesterday" or "Thu, Oct 30". */
export function loggedDay(date: string, now: number, tz?: string): string {
  const today = localDate(now, tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC');
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return shortDate(date);
}

/** "1,234". */
export const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** What's missing from a typed flight, or null when it can be added. */
export function typedFlightProblem(f: { airline: string; flightNumber: string; from: string; to: string }): string | null {
  if (!/^[A-Z0-9]{2,3}$/.test(f.airline)) return 'Add the airline code, like AA.';
  if (!/^\d{1,4}[A-Z]?$/.test(f.flightNumber)) return 'Add the flight number.';
  if (!/^[A-Z]{3}$/.test(f.from)) return 'Add where you flew from, like DFW.';
  if (!/^[A-Z]{3}$/.test(f.to)) return 'Add where you flew to, like LAX.';
  if (f.from === f.to) return 'From and To are the same airport.';
  return null;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const SOURCES: readonly LogSource[] = ['scan', 'photo', 'manual'];

function parseLogged(raw: unknown): LoggedFlight | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (!isStr(o.airline) || !isStr(o.flightNumber) || !isStr(o.from) || !isStr(o.to) || !isStr(o.date)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  const base = { airline: o.airline, flightNumber: o.flightNumber, from: o.from, to: o.to, date: o.date };
  if (typedFlightProblem(base)) return null;
  const f: LoggedFlight = {
    ...base,
    id: loggedId(base),
    source: SOURCES.includes(o.source as LogSource) ? (o.source as LogSource) : 'manual',
    addedAt: typeof o.addedAt === 'number' && Number.isFinite(o.addedAt) ? o.addedAt : 0,
  };
  if (isStr(o.seat) && o.seat) f.seat = o.seat;
  return f;
}

/** Saved JSON (or anything) -> valid logged flights; bad entries and repeats are dropped. */
export function parseLogbook(raw: unknown): LoggedFlight[] {
  if (!Array.isArray(raw)) return [];
  return addLogged([], raw.map(parseLogged).filter((f): f is LoggedFlight => f != null));
}
