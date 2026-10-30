/**
 * Leave-by card math (backlog 12; Q-003, Q-023). Follows the v9.1 prototype:
 * be at the airport `bufferMin` before the first departure, and leave a
 * drive estimate earlier when a fresh phone location is known.
 */
import type { Airport } from '@/engine';

import { formatTime } from './format';

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
  return Math.round(((km * 1.3) / 55 * 60 + 10) / 5) * 5;
}

export type LeaveBy =
  | { kind: 'departed'; airport: string }
  | { kind: 'atAirport'; airport: string; departUtc: number }
  | { kind: 'leaveBy'; airport: string; leaveUtc: number; beAtUtc: number; driveMin: number }
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
}): LeaveBy {
  const { airport, departUtc, bufferMin, now } = input;
  const beAtUtc = departUtc - bufferMin * 60_000;
  const loc = input.location && now - input.location.at <= LOCATION_FRESH_MS ? input.location : null;
  // Results keep routes that already left (grayed, on top); "Leave now" would be wrong for those.
  if (input.departed) return { kind: 'departed', airport: airport.code };

  if (loc) {
    const km = distanceKm(loc.lat, loc.lon, airport.lat, airport.lon);
    if (km < AT_AIRPORT_KM) return { kind: 'atAirport', airport: airport.code, departUtc };
    if (km <= MAX_DRIVE_KM) {
      const driveMin = driveMinutes(km);
      const leaveUtc = beAtUtc - driveMin * 60_000;
      if (leaveUtc <= now) return { kind: 'leaveNow', airport: airport.code, beAtUtc };
      return { kind: 'leaveBy', airport: airport.code, leaveUtc, beAtUtc, driveMin };
    }
  }
  if (beAtUtc <= now) return { kind: 'leaveNow', airport: airport.code, beAtUtc };
  return { kind: 'beAt', airport: airport.code, beAtUtc, bufferMin };
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
      return { title: `You’re at ${r.airport}`, sub: `Departs ${t(r.departUtc)}` };
    case 'leaveBy':
      return { title: `Leave by ${t(r.leaveUtc)}`, sub: `~${r.driveMin} min drive from where you are · at ${r.airport} by ${t(r.beAtUtc)}` };
    case 'leaveNow':
      return { title: 'Leave now', sub: `Be at ${r.airport} by ${t(r.beAtUtc)}` };
    case 'beAt':
      return { title: `Be at ${r.airport} by ${t(r.beAtUtc)}`, sub: `${r.bufferMin} min before departure to list and clear security` };
  }
}
