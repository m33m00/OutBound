/**
 * Leave-by card math (backlog 12; Q-003, Q-023). Follows the v9.1 prototype:
 * be at the airport `bufferMin` before the first departure, and leave a
 * drive estimate earlier when a fresh phone location is known.
 */
import { AIRPORTS, type Airport } from '@/engine';

import { formatDuration, formatTime } from './format';

export interface PhoneLocation {
  lat: number;
  lon: number;
  /** When the fix was taken (epoch ms). */
  at: number;
}

/** A location older than this isn't used (prototype: 20 min). */
export const LOCATION_FRESH_MS = 20 * 60_000;
/** Drive estimates only within this distance. */
export const MAX_DRIVE_KM = 400;
/** Closer than this counts as being at the airport. */
export const AT_AIRPORT_KM = 3;

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Prototype estimate: road factor 1.3 at 55 km/h plus 10 min, rounded to 5. */
export function driveMinutes(km: number): number {
  return Math.round((((km * 1.3) / 55) * 60 + 10) / 5) * 5;
}

/**
 * When boarding starts, since no feed gives a boarding time (round 162, John): 40 minutes before a domestic
 * departure, 50 before an international or widebody one, which board sooner.
 */
export const BOARDING_DOMESTIC_MIN = 40;
export const BOARDING_LONG_MIN = 50;

/** Twin-aisle types as providers name them ("Boeing 777-300ER", "Airbus A350-900"); not the 757. */
const WIDEBODY = /(?:^|[^0-9])7[4678]7(?![0-9])|\bA3[3458]\d|\bA380\b|\bMD-?11\b|\bDC-?10\b/i;

export function isWidebody(aircraft: string | null | undefined): boolean {
  return !!aircraft && WIDEBODY.test(aircraft);
}

/** Minutes before departure that boarding starts for a flight from `from` to `to` on `aircraft`. */
export function boardingLeadMin(
  from: string,
  to: string,
  aircraft?: string | null,
  airports: Readonly<Record<string, { country?: string }>> = AIRPORTS,
): number {
  const country = (code: string) => airports[code]?.country ?? 'US';
  const international = country(from) !== country(to);
  return international || isWidebody(aircraft) ? BOARDING_LONG_MIN : BOARDING_DOMESTIC_MIN;
}

export type LeaveBy =
  | { kind: 'departed'; airport: string }
  | { kind: 'atAirport'; airport: string; departUtc: number; boardUtc: number }
  | { kind: 'leaveBy'; airport: string; leaveUtc: number; beAtUtc: number; driveMin: number; live: boolean }
  | { kind: 'leaveNow'; airport: string; beAtUtc: number }
  | { kind: 'beAt'; airport: string; beAtUtc: number; bufferMin: number };

export function computeLeaveBy(input: {
  airport: Airport;
  departUtc: number;
  bufferMin: number;
  now: number;
  location: PhoneLocation | null;
  /** Live status says the flight has left. Never guessed from the schedule (Q-050). */
  departed?: boolean;
  /** Drive minutes from a maps service, with traffic (John, 2026-11-01); else the rough estimate. */
  liveDriveMin?: number | null;
  /** Boarding starts this long before departure (round 162); see boardingLeadMin. Default domestic. */
  boardingMin?: number;
}): LeaveBy {
  const { airport, departUtc, bufferMin, now } = input;
  const beAtUtc = departUtc - bufferMin * 60_000;
  const loc = input.location && now - input.location.at <= LOCATION_FRESH_MS ? input.location : null;
  // Results keep routes that already left (grayed, on top); "Leave now" would be wrong for those.
  if (input.departed) return { kind: 'departed', airport: airport.code };

  if (loc) {
    const km = distanceKm(loc.lat, loc.lon, airport.lat, airport.lon);
    if (km < AT_AIRPORT_KM) {
      const boardUtc = departUtc - (input.boardingMin ?? BOARDING_DOMESTIC_MIN) * 60_000;
      return { kind: 'atAirport', airport: airport.code, departUtc, boardUtc };
    }
    if (km <= MAX_DRIVE_KM) {
      const live = input.liveDriveMin != null && input.liveDriveMin > 0;
      const driveMin = live ? Math.round(input.liveDriveMin!) : driveMinutes(km);
      const leaveUtc = beAtUtc - driveMin * 60_000;
      if (leaveUtc <= now) return { kind: 'leaveNow', airport: airport.code, beAtUtc };
      return { kind: 'leaveBy', airport: airport.code, leaveUtc, beAtUtc, driveMin, live };
    }
  }
  if (beAtUtc <= now) return { kind: 'leaveNow', airport: airport.code, beAtUtc };
  return { kind: 'beAt', airport: airport.code, beAtUtc, bufferMin };
}

/**
 * The trip to ask a maps service about: from the phone to the airport, leaving around the rough
 * leave-by time (so traffic is for then). Null when no drive estimate would show.
 */
export function driveQuery(input: {
  airport: Airport;
  departUtc: number;
  bufferMin: number;
  now: number;
  location: PhoneLocation | null;
  departed?: boolean;
}): { from: { lat: number; lon: number }; to: { lat: number; lon: number }; departMs: number } | null {
  const { airport, location: loc, now } = input;
  if (input.departed || !loc || now - loc.at > LOCATION_FRESH_MS) return null;
  const km = distanceKm(loc.lat, loc.lon, airport.lat, airport.lon);
  if (km < AT_AIRPORT_KM || km > MAX_DRIVE_KM) return null;
  const beAtUtc = input.departUtc - input.bufferMin * 60_000;
  if (beAtUtc <= now) return null;
  const departMs = Math.max(now, beAtUtc - driveMinutes(km) * 60_000);
  return { from: { lat: loc.lat, lon: loc.lon }, to: { lat: airport.lat, lon: airport.lon }, departMs };
}

/** "You’re at DAL (Dallas Love Field)". */
function youreAt(code: string): string {
  const name = AIRPORTS[code]?.name;
  return name ? `You’re at ${code} (${name})` : `You’re at ${code}`;
}

/** "Arrive at DFW by 10:10 AM to begin boarding" (round 159, John). */
function arriveBy(code: string, time: string): string {
  return `Arrive at ${code} by ${time} to begin boarding`;
}

/** "Your flight begins boarding at 11:00 AM" (round 159, John), from boardingLeadMin (round 162). */
function boardingAt(time: string): string {
  return `Your flight begins boarding at ${time}`;
}

export interface LeaveByText {
  title: string;
  sub: string;
}

/** Card copy; times are local at the departure airport. */
export function leaveByText(r: LeaveBy, tz: string): LeaveByText {
  const t = (utc: number) => formatTime(utc, tz);
  switch (r.kind) {
    case 'departed':
      return { title: 'Departed', sub: `This flight has left ${r.airport}. Pick a later route.` };
    case 'atAirport':
      // The airport's name too (John, 2026-11-02), and boarding in his words (round 159, John).
      return { title: youreAt(r.airport), sub: boardingAt(t(r.boardUtc)) };
    case 'leaveBy':
      // No "~" on the guess (round 138, John); a maps-service time adds "with traffic".
      return {
        title: `Leave by ${t(r.leaveUtc)}`,
        sub: `${formatDuration(r.driveMin)} drive${r.live ? ' with traffic' : ''}. ${arriveBy(r.airport, t(r.beAtUtc))}`,
      };
    case 'leaveNow':
      return { title: 'Leave now', sub: arriveBy(r.airport, t(r.beAtUtc)) };
    case 'beAt':
      // John's words (round 159): "Arrive at DFW by 10:10 AM to begin boarding".
      return {
        title: arriveBy(r.airport, t(r.beAtUtc)),
        sub: `${formatDuration(r.bufferMin)} early to list and clear security`,
      };
  }
}

/**
 * The one short detail beside the title on the slim Leave By row (John, 2026-11-01: the card was
 * too tall for what it says). The full line stays in the spoken label.
 */
export function leaveByShort(r: LeaveBy, tz: string): string {
  const t = (utc: number) => formatTime(utc, tz);
  switch (r.kind) {
    case 'departed':
      return 'Pick a later route';
    case 'atAirport':
      return boardingAt(t(r.boardUtc));
    case 'leaveBy':
      return `${formatDuration(r.driveMin)} drive`;
    case 'leaveNow':
      // Spelled out (John, 2026-11-03), ending "to begin boarding" (round 159, John).
      return arriveBy(r.airport, t(r.beAtUtc));
    case 'beAt':
      // The title already says it all (round 159), so no second detail beside it.
      return '';
  }
}
