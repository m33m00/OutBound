import type {
  FlightRequest,
  FlightState,
  FlightStatus,
  FlightStatusResponse,
  Movement,
} from '../../supabase/functions/_shared/flightStatus';
import { FLIGHT_STATUS_CONFIG } from '../../supabase/functions/_shared/flightStatusConfig';
import type { Fetcher, LiveConfig } from './airportStatus';

export type { FlightState, FlightStatus, FlightStatusResponse, Movement };

/** What the app knows about a flight it wants status for. */
export interface FlightLookup {
  /** IATA airline + number, e.g. "AA" and "123" -> "AA123". */
  airline: string;
  flightNumber: string;
  /** Local departure date at the origin, YYYY-MM-DD. */
  date: string;
  from: string;
  departUtc: number;
}

export const CLIENT_COOLDOWN_MS = FLIGHT_STATUS_CONFIG.clientCooldownMs;

export const flightLookupKey = (l: FlightLookup): string =>
  `${l.airline}${l.flightNumber}|${l.date}|${l.from}`.toUpperCase().replace(/\s+/g, '');

/** True when a manual refresh is allowed (not within the cooldown of the last request for this flight). */
export function refreshAllowed(lastRequestMs: number | null, nowMs: number, cooldownMs = CLIENT_COOLDOWN_MS): boolean {
  return lastRequestMs == null || nowMs - lastRequestMs >= cooldownMs;
}

/** Calls the live-flight-status Edge Function. Throws on a non-OK response. */
export async function fetchFlightStatus(
  lookup: FlightLookup,
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<FlightStatusResponse> {
  const flight = `${lookup.airline}${lookup.flightNumber}`.replace(/\s+/g, '').toUpperCase();
  const q = new URLSearchParams({ flight, date: lookup.date, from: lookup.from, dep: String(Math.round(lookup.departUtc)) });
  const url = `${config.baseUrl}/functions/v1/live-flight-status?${q.toString()}`;
  const res = await fetcher(url, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
  if (!res.ok) throw new Error(`live-flight-status ${res.status}`);
  return (await res.json()) as FlightStatusResponse;
}

export type { FlightRequest };
