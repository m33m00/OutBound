import type {
  BatchResponse,
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

export type { FlightRequest, BatchResponse };

/** What the app shows per flight: the server status plus its age and stale flag. */
export interface FlightStatusEntry extends FlightStatus {
  /** When the server last got this from the provider (ISO); show "updated 4m ago" from it. Null if unknown. */
  asOf: string | null;
  /** Older than its cache time because the provider could not be asked (or the app could not reach the server). */
  stale: boolean;
  /** Departure delay in minutes (falls back to arrival delay); negative = early; null = unknown. */
  delayMin: number | null;
}

export const BATCH_MAX = FLIGHT_STATUS_CONFIG.batchMax;

const lookupBody = (l: FlightLookup) => ({
  flight: `${l.airline}${l.flightNumber}`.replace(/\s+/g, '').toUpperCase(),
  date: l.date,
  from: l.from,
  dep: Math.round(l.departUtc),
});

/** Unique lookups by flightLookupKey (first wins), keeping order. */
export function dedupeLookups(lookups: readonly FlightLookup[]): { key: string; lookup: FlightLookup }[] {
  const seen = new Map<string, FlightLookup>();
  for (const l of lookups) {
    const k = flightLookupKey(l);
    if (!seen.has(k)) seen.set(k, l);
  }
  return [...seen].map(([key, lookup]) => ({ key, lookup }));
}

/**
 * Batch lookup for a results list: dedupes by flight + date + origin, sends at most BATCH_MAX per request
 * (POST live-flight-status), returns an entry per flight the server could answer, keyed by flightLookupKey.
 * Flights with no status (not found / provider down and nothing cached / invalid) are simply absent.
 * Throws if any request fails (the caller decides how to degrade).
 */
export async function fetchFlightStatuses(
  lookups: readonly FlightLookup[],
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<Record<string, FlightStatusEntry>> {
  const unique = dedupeLookups(lookups);
  const out: Record<string, FlightStatusEntry> = {};
  for (let i = 0; i < unique.length; i += BATCH_MAX) {
    const chunk = unique.slice(i, i + BATCH_MAX);
    const res = await fetcher(`${config.baseUrl}/functions/v1/live-flight-status`, {
      method: 'POST',
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ flights: chunk.map((c) => lookupBody(c.lookup)) }),
    });
    if (!res.ok) throw new Error(`live-flight-status ${res.status}`);
    const body = (await res.json()) as BatchResponse;
    // Results are positional; map by position back to OUR keys (the server key omits nothing we need).
    chunk.forEach((c, idx) => {
      const r = body.results?.[idx];
      if (!r || !r.status) return;
      const s = r.status;
      out[c.key] = { ...s, asOf: r.fetchedAt, stale: r.stale, delayMin: s.departure.delayMin ?? s.arrival.delayMin };
    });
  }
  return out;
}
