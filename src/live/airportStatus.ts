import type { AirportStatus, LiveFaaStatusResponse } from '../../supabase/functions/_shared/faaStatus';

export type { AirportStatus, LiveFaaStatusResponse };
export type { AirportStatusLevel, FaaEvent, FaaEventType } from '../../supabase/functions/_shared/faaStatus';

export type Fetcher = (url: string, init?: { headers?: Record<string, string>; method?: string; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface LiveConfig {
  baseUrl: string;
  anonKey: string;
}

/**
 * The app's public env. Expo bakes EXPO_PUBLIC_* values into the bundle only where the code says
 * process.env.EXPO_PUBLIC_NAME directly, so each one is read by name here; passing process.env
 * around as an object reads an empty object in a published build.
 */
export const PUBLIC_ENV: Record<string, string | undefined> = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SCHEDULES: process.env.EXPO_PUBLIC_SCHEDULES,
};

/** Reads the public Supabase config; null when not set up yet. */
export function readLiveConfig(env: Record<string, string | undefined> = PUBLIC_ENV): LiveConfig | null {
  const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return baseUrl && anonKey ? { baseUrl: baseUrl.replace(/\/+$/, ''), anonKey } : null;
}

export const normalizeCodes = (codes: readonly string[]): string[] =>
  [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))].sort();

/** Calls the live-faa-status Edge Function. Throws on a non-OK response. */
export async function fetchAirportStatus(
  codes: readonly string[],
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<LiveFaaStatusResponse> {
  const list = normalizeCodes(codes);
  const url = `${config.baseUrl}/functions/v1/live-faa-status?airports=${encodeURIComponent(list.join(','))}`;
  const res = await fetcher(url, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
  if (!res.ok) throw new Error(`live-faa-status ${res.status}`);
  return (await res.json()) as LiveFaaStatusResponse;
}
