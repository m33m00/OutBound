import type { LiveRadarResponse, RadarRegion, RadarRegionFrame } from '../../supabase/functions/_shared/radar';
import { frameStatus, parseRegions } from '../../supabase/functions/_shared/radar';
import { RADAR_CONFIG } from '../../supabase/functions/_shared/radarConfig';
import type { Fetcher, LiveConfig } from './airportStatus';

export type { LiveRadarResponse, RadarRegion, RadarRegionFrame };

/** Source for an image loader (Skia useImage / RN Image). The image route needs the anon key headers. */
export interface RadarImageSource {
  uri: string;
  headers: Record<string, string>;
}

export interface RadarFrame {
  region: RadarRegion;
  /** The frame's own time (ISO). Show "radar updated Xm ago" from this. */
  observedAt: string;
  /** [west, south, east, north] degrees; the image covers exactly this box (equirectangular). */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  image: RadarImageSource;
  stale: boolean;
  /** False when too old to show: hide the overlay. Frames that are unavailable on the server are omitted. */
  available: boolean;
}

export const radarFunctionUrl = (config: LiveConfig): string => `${config.baseUrl}/functions/v1/live-radar`;

export const authHeaders = (config: LiveConfig): Record<string, string> => ({
  apikey: config.anonKey,
  Authorization: `Bearer ${config.anonKey}`,
});

/** Regions sorted, deduped, unknown names dropped. */
export function normalizeRadarRegions(regions: readonly string[]): RadarRegion[] {
  return parseRegions(regions.join(',')).regions;
}

export function buildRadarRequestUrl(regions: readonly string[], config: LiveConfig): string {
  return `${radarFunctionUrl(config)}?regions=${normalizeRadarRegions(regions).join(',')}`;
}

/** Turns the server's relative imageUrl ("?image=conus&t=...") into an absolute, authenticated source. */
export function radarImageSource(config: LiveConfig, imageUrl: string): RadarImageSource {
  return { uri: `${radarFunctionUrl(config)}${imageUrl}`, headers: authHeaders(config) };
}

/**
 * Server response -> frames the map can draw. Availability is re-checked against `nowMs` because the
 * response may be minutes old. Regions with no picture (no observedAt or imageUrl) are dropped.
 */
export function framesFromResponse(res: LiveRadarResponse, config: LiveConfig, nowMs: number): RadarFrame[] {
  const out: RadarFrame[] = [];
  for (const r of res.regions) {
    if (!r.observedAt || !r.imageUrl) continue;
    const observedMs = Date.parse(r.observedAt);
    if (!Number.isFinite(observedMs)) continue;
    const st = frameStatus({ observedMs, checkedAt: null, failures: r.stale ? 1 : 0, nextRetryAt: 0 }, nowMs);
    out.push({
      region: r.region,
      observedAt: r.observedAt,
      bbox: r.bbox,
      width: r.width,
      height: r.height,
      image: radarImageSource(config, r.imageUrl),
      stale: r.stale || st.stale,
      available: r.available && st.available,
    });
  }
  return out;
}

/** Calls live-radar. Throws on a non-OK response. */
export async function fetchRadar(
  regions: readonly string[],
  config: LiveConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<LiveRadarResponse> {
  const res = await fetcher(buildRadarRequestUrl(regions, config), { headers: authHeaders(config) });
  if (!res.ok) throw new Error(`live-radar ${res.status}`);
  return (await res.json()) as LiveRadarResponse;
}

/** Clamp a poll interval to the configured bounds. Non-finite or <= 0 means "do not poll" (null). */
export function clampRefreshMs(refreshMs: number | undefined): number | null {
  const { defaultMs, minMs, maxMs } = RADAR_CONFIG.clientRefresh;
  const v = refreshMs === undefined ? defaultMs : refreshMs;
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(maxMs, Math.max(minMs, v));
}

/** Next poll delay: base after success, doubling per consecutive failure, capped at the max bound. */
export function nextRefreshDelay(baseMs: number, failures: number): number {
  return Math.min(RADAR_CONFIG.clientRefresh.maxMs, baseMs * Math.pow(2, Math.max(0, failures)));
}
