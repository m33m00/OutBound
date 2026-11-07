/**
 * Search filters beyond stops and connections (round 174, John 2026-11-07: "Time of day filter,
 * Airports to avoid, Only answered loads, Airline filter, US airlines only or all"). Pure, for tests.
 */
import { tzOffsetMin } from './time';

/** Parts of the day a route can leave in, by local time at its first airport. */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const TIMES_OF_DAY: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

/** Start and end in minutes after local midnight; night wraps past midnight. Provisional bounds. */
export const TIME_OF_DAY_WINDOW: Record<TimeOfDay, { start: number; end: number }> = {
  morning: { start: 5 * 60, end: 12 * 60 },
  afternoon: { start: 12 * 60, end: 17 * 60 },
  evening: { start: 17 * 60, end: 21 * 60 },
  night: { start: 21 * 60, end: 5 * 60 },
};

/** Minutes after local midnight at `tz`. */
export function localMinuteOfDay(utc: number, tz: string): number {
  const m = Math.floor((utc + tzOffsetMin(utc, tz) * 60_000) / 60_000) % 1440;
  return m < 0 ? m + 1440 : m;
}

export function timeOfDayOf(minuteOfDay: number): TimeOfDay {
  for (const t of TIMES_OF_DAY) {
    const { start, end } = TIME_OF_DAY_WINDOW[t];
    if (start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end) return t;
  }
  return 'night';
}

/** True when nothing is picked (any time) or the departure falls in a picked window. */
export function leavesInTimes(departUtc: number, tz: string, times: readonly TimeOfDay[]): boolean {
  if (!times.length) return true;
  return times.includes(timeOfDayOf(localMinuteOfDay(departUtc, tz)));
}

/** Which airlines a route may use. */
export type AirlineRegion = 'all' | 'us';

/**
 * US passenger airlines and the regionals that fly for them, by IATA code. An airline missing here
 * counts as not US, so US only never lets an unknown carrier through.
 */
export const US_AIRLINES: ReadonlySet<string> = new Set([
  'AA',
  'AS',
  'B6',
  'DL',
  'F9',
  'G4',
  'HA',
  'MX',
  'NK',
  'SY',
  'UA',
  'WN',
  'XP',
  // Regionals flying as American, Delta, United or Alaska.
  '9E',
  'C5',
  'G7',
  'MQ',
  'OH',
  'OO',
  'PT',
  'QX',
  'YV',
  'YX',
  'ZW',
]);

export function isUsAirline(code: string): boolean {
  return US_AIRLINES.has(code);
}

/** True when a leg on `airline` may be used under the airline picks and US only. */
export function airlineAllowed(airline: string, picked: readonly string[], region: AirlineRegion): boolean {
  if (region === 'us' && !isUsAirline(airline)) return false;
  return !picked.length || picked.includes(airline);
}
