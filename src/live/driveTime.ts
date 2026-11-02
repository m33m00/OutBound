/**
 * Live drive time to the departure airport (John, 2026-11-01). Calls the live-drive-time Edge
 * Function, which asks a maps service for the drive with traffic. When the function isn't set up
 * or can't answer, the Leave By card keeps its rough straight-line estimate.
 */
import type { LatLon, LiveDriveTimeResponse } from '../../supabase/functions/_shared/driveTime';
import type { Fetcher, LiveConfig } from './airportStatus';

export type { LatLon, LiveDriveTimeResponse };

/** Origin sent at about 100 m, never the exact spot. */
const coarse = (v: number) => (Math.round(v * 1000) / 1000).toString();

export function buildDriveTimeUrl(config: LiveConfig, from: LatLon, to: LatLon, departMs: number): string {
  const q = new URLSearchParams({
    from: `${coarse(from.lat)},${coarse(from.lon)}`,
    to: `${to.lat},${to.lon}`,
    depart: String(Math.round(departMs)),
  });
  return `${config.baseUrl}/functions/v1/live-drive-time?${q.toString()}`;
}

/** Throws on a non-OK response (e.g. the function isn't deployed yet). */
export async function fetchDriveTime(
  config: LiveConfig,
  from: LatLon,
  to: LatLon,
  departMs: number,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<LiveDriveTimeResponse> {
  const res = await fetcher(buildDriveTimeUrl(config, from, to, departMs), {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
  });
  if (!res.ok) throw new Error(`live-drive-time ${res.status}`);
  return (await res.json()) as LiveDriveTimeResponse;
}
