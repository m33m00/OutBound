/**
 * At-airport shortcut (DECISIONS.md "Reports and requests"): within about
 * 4 km of an airport, Search offers "At DAL? Report a load" and lists that
 * airport's departures to pick from the board (design round 33).
 */
import type { Flight } from '@/engine';
import { SEARCH_AIRPORTS } from '@/search/airports';
import { distanceKm } from '@/search/leaveBy';

import { SAMPLE_MY_AIRLINE, sampleFlightsBetween } from './requests';

/** "Within ~4 km" (DECISIONS.md). */
export const AT_AIRPORT_KM = 4;
/** A fix older than this doesn't say where you are now (prototype v9.1: 20 min). */
export const AT_AIRPORT_FRESH_MS = 20 * 60_000;
/** The board: flights that left up to 30 minutes ago through the next 5 hours (prototype v9.1). */
export const DEPARTURES_BEHIND_MS = 30 * 60_000;
export const DEPARTURES_AHEAD_MS = 5 * 3600_000;

export interface Fix {
  lat: number;
  lon: number;
  at: number;
}

/** The airport you're at, or null when no fresh fix puts you within 4 km of one. */
export function airportYouAreAt(fix: Fix | null, now: number): string | null {
  if (!fix || now - fix.at > AT_AIRPORT_FRESH_MS) return null;
  let best: string | null = null;
  let bestKm = AT_AIRPORT_KM;
  for (const a of SEARCH_AIRPORTS) {
    const km = distanceKm(fix.lat, fix.lon, a.lat, a.lon);
    if (km <= bestKm) {
      best = a.code;
      bestKm = km;
    }
  }
  return best;
}

/** Sample departures from an airport on the board now: your airline first, then by time. */
export function sampleDepartures(code: string, now: number, airline = SAMPLE_MY_AIRLINE): Flight[] {
  return sampleFlightsBetween(now, -DEPARTURES_BEHIND_MS, DEPARTURES_AHEAD_MS)
    .filter((f) => f.from === code)
    .sort((a, b) => (a.airline === airline ? 0 : 1) - (b.airline === airline ? 0 : 1) || a.departUtc - b.departUtc);
}

/** The card's second line. */
export function atAirportNote(code: string, count: number): string {
  if (!count) return `No more departures from ${code} in the next 5 hours.`;
  return `${count} ${count === 1 ? 'departure' : 'departures'} in the next 5 hours. Pick yours from the board.`;
}
