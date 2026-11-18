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
/** Drive times from a maps service only within this distance. */
export const MAX_DRIVE_KM = 400;
/**
 * The rough straight-line guess only this close (about a 2h 30m drive). Farther out it guessed things like an 8 hour
 * drive, so the card says when to be at the airport instead until a maps service answers (round 218, John: "Fix all
 * of them").
 */
export const MAX_ESTIMATE_KM = 100;
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
  | { kind: 'leaveNow'; airport: string; beAtUtc: number; driveMin?: number }
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
    const live = input.liveDriveMin != null && input.liveDriveMin > 0;
    if (km <= (live ? MAX_DRIVE_KM : MAX_ESTIMATE_KM)) {
      const driveMin = live ? Math.round(input.liveDriveMin!) : driveMinutes(km);
      const leaveUtc = beAtUtc - driveMin * 60_000;
      if (leaveUtc <= now) return { kind: 'leaveNow', airport: airport.code, beAtUtc, driveMin };
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
      // One short line on screen (round 219, John: "I dont like the text wraps here"); VoiceOver still hears the
      // airport's name (John, 2026-11-02) and boarding in his words (round 159).
      return {
        title: `You’re at ${r.airport}`,
        sub: [AIRPORTS[r.airport]?.name, boardingAt(t(r.boardUtc))].filter(Boolean).join('. '),
      };
    case 'leaveBy':
      // No "~" on the guess (round 138, John); a maps-service time adds "with traffic".
      return {
        title: `Leave by ${t(r.leaveUtc)}`,
        sub: `${formatDuration(r.driveMin)} drive${r.live ? ' with traffic' : ''}. ${arriveBy(r.airport, t(r.beAtUtc))}`,
      };
    case 'leaveNow':
      return { title: 'Leave now', sub: arriveBy(r.airport, t(r.beAtUtc)) };
    case 'beAt':
      // "Arrive at DFW by 10:10 AM" (round 159), boarding left implied so it fits one line (round 219, John: "I
      // dont like the text wraps here").
      return {
        title: `Arrive at ${r.airport} by ${t(r.beAtUtc)}`,
        sub: `${formatDuration(r.bufferMin)} early to list and clear security`,
      };
  }
}

/**
 * The drive time shown next to the car on the Leave By card's directions button (round 169, John:
 * "can the estimated time to drive there be next to the car icon"). Null when there's no location,
 * so no drive to time.
 */
export function driveTimeText(r: LeaveBy): string | null {
  if (r.kind === 'leaveBy') return formatDuration(r.driveMin);
  if (r.kind === 'leaveNow' && r.driveMin != null) return formatDuration(r.driveMin);
  return null;
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
      // Short, so "You’re at DAL | Boarding at 8:20 AM" stays one line (round 219).
      return `Boarding at ${t(r.boardUtc)}`;
    case 'leaveBy':
    case 'leaveNow':
      // No line under the time (round 205, John: "We don't need the commentary ... below the Leave Now at the
      // top"): the drive time sits by the car on the button (round 169), and VoiceOver still hears the arrive-by
      // line with the title. Leave by and Leave now stay alike (round 193).
      return '';
    case 'beAt':
      // The title already says it all (round 159), so no second detail beside it.
      return '';
  }
}
