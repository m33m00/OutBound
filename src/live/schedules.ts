/**
 * Real flight schedules (backlog 25): a FlightDataProvider that reads the live-schedules Edge Function, which serves
 * our own schedule DB (daily AeroDataBox pulls). Never a live AeroDataBox call per search (DECISIONS.md "Search").
 * Off until EXPO_PUBLIC_SCHEDULES=live is set, so the app keeps sample flights until the DB is filled.
 */
import { AIRPORTS, type Flight, type FlightDataProvider } from '@/engine';

import type { LiveSchedulesResponse } from '../../supabase/functions/_shared/schedules';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';

export type { LiveSchedulesResponse };

/** Where search flights come from. */
export type ScheduleSource = 'live' | 'sample';

/** 'live' only when the switch is on AND the Supabase config exists. */
export function readScheduleSource(env: Record<string, string | undefined> = process.env): ScheduleSource {
  return env.EXPO_PUBLIC_SCHEDULES === 'live' && readLiveConfig(env) ? 'live' : 'sample';
}

/** Calls live-schedules for one airport and window. Throws on a non-OK response. */
export async function fetchDepartures(
  airport: string,
  fromUtc: number,
  toUtc: number,
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<LiveSchedulesResponse> {
  const q = `airport=${encodeURIComponent(airport)}&from=${Math.floor(fromUtc)}&to=${Math.ceil(toUtc)}`;
  const res = await fetcher(`${config.baseUrl}/functions/v1/live-schedules?${q}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
  });
  if (!res.ok) throw new Error(`live-schedules ${res.status}`);
  return (await res.json()) as LiveSchedulesResponse;
}

export interface ScheduleProviderOptions {
  config: LiveConfig;
  fetcher?: Fetcher;
  /** How long one airport-window answer is reused on the phone. Default 15 min. */
  cacheMs?: number;
  now?: () => number;
}

/** Client cache lifetime: schedules change at most once a day; the server caches 10 min too. */
export const SCHEDULE_CLIENT_CACHE_MS = 15 * 60_000;

/**
 * Search provider over the schedule DB. Departures are cached per airport + window; a failed read is not cached,
 * so the next search tries again. No seat sources exist for real flights yet, so every leg's seats are Unknown
 * (reports and estimates come later; sample seats would be made up).
 */
export function createScheduleProvider(opts: ScheduleProviderOptions): FlightDataProvider {
  const { config, fetcher } = opts;
  const cacheMs = opts.cacheMs ?? SCHEDULE_CLIENT_CACHE_MS;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { at: number; flights: Promise<Flight[]> }>();

  return {
    getDepartures(airport, fromUtc, toUtc) {
      const key = `${airport}|${fromUtc}|${toUtc}`;
      const hit = cache.get(key);
      if (hit && now() - hit.at < cacheMs) return hit.flights;
      const flights = fetchDepartures(airport, fromUtc, toUtc, config, fetcher).then(
        (r) => r.flights.filter((f) => f.from === airport && f.departUtc >= fromUtc && f.departUtc < toUtc && AIRPORTS[f.to]),
      );
      cache.set(key, { at: now(), flights });
      flights.catch(() => {
        if (cache.get(key)?.flights === flights) cache.delete(key);
      });
      return flights;
    },
    async getSeatReports() {
      return [];
    },
    getAirport(code) {
      return AIRPORTS[code];
    },
  };
}
