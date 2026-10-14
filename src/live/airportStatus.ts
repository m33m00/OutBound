import type { AirportStatus, LiveFaaStatusResponse } from '../../supabase/functions/_shared/faaStatus';

export type { AirportStatus, LiveFaaStatusResponse };
export type { AirportStatusLevel, FaaEvent, FaaEventType } from '../../supabase/functions/_shared/faaStatus';

export type Fetcher = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface LiveConfig {
  baseUrl: string;
  anonKey: string;
}

/** Reads the public Supabase config; null when not set up yet. */
export function readLiveConfig(env: Record<string, string | undefined> = process.env): LiveConfig | null {
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
