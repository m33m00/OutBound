/**
 * Radar pass-through logic (backlog 13). Pure TypeScript (fetch and clock are injected), NO imports beyond config.
 * The function never decodes or re-encodes a PNG: it relays NOAA's bytes and remembers the newest frame per region.
 */
import { RADAR_CONFIG, RADAR_REGIONS, type RadarConfig, type RadarRegion } from './radarConfig.ts';

export type { RadarRegion };

// ---- Response contract ----

export interface RadarRegionFrame {
  region: RadarRegion;
  /** The radar frame's own time (ISO, from the WMS time dimension). Null when never known. */
  observedAt: string | null;
  /** [west, south, east, north] degrees. The image covers exactly this box (equirectangular). */
  bbox: [number, number, number, number];
  width: number;
  height: number;
  /** Relative query string for this same function, e.g. "?image=conus&t=2026-10-14T07%3A16%3A16Z". Null when no frame. */
  imageUrl: string | null;
  /** Upstream check failing, or the frame is older than staleAfterMs. */
  stale: boolean;
  /** False when there is no frame or it is older than maxAgeMs: hide the overlay, do not imply "no rain". */
  available: boolean;
}

export interface LiveRadarResponse {
  attribution: string;
  regions: RadarRegionFrame[];
}

// ---- Pure helpers ----

/** "conus,hi" -> regions in canonical order, deduped. `invalid` lists unknown names. */
export function parseRegions(param: string | null): { regions: RadarRegion[]; invalid: string[] } {
  const wanted = new Set<string>();
  const invalid: string[] = [];
  for (const raw of (param ?? '').split(',')) {
    const r = raw.trim().toLowerCase();
    if (!r) continue;
    if ((RADAR_REGIONS as string[]).includes(r)) wanted.add(r);
    else invalid.push(r);
  }
  return { regions: RADAR_REGIONS.filter((r) => wanted.has(r)), invalid };
}

/** `image` param: exactly one known region, else null. */
export function parseImageRegion(param: string | null): RadarRegion | null {
  const { regions, invalid } = parseRegions(param);
  return regions.length === 1 && invalid.length === 0 && (param ?? '').split(',').filter((x) => x.trim()).length === 1
    ? regions[0]
    : null;
}

export function imageHeight(region: RadarRegion, cfg: RadarConfig = RADAR_CONFIG): number {
  const { bbox, width } = cfg.regions[region];
  return Math.round((width * (bbox[3] - bbox[1])) / (bbox[2] - bbox[0]));
}

export function buildCapabilitiesUrl(region: RadarRegion, cfg: RadarConfig = RADAR_CONFIG): string {
  const { workspace, layer } = cfg.regions[region];
  return `${cfg.wmsBase}/${workspace}/${layer}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
}

/**
 * GetMap for one frame. Uses CRS:84 (lon,lat order, no axis-order trap) and pins `time` so the picture
 * always matches the observedAt we reported.
 */
export function buildImageUrl(region: RadarRegion, observedAt: string, cfg: RadarConfig = RADAR_CONFIG): string {
  const { workspace, layer, bbox, width } = cfg.regions[region];
  const q = [
    'service=WMS',
    'version=1.3.0',
    'request=GetMap',
    `layers=${layer}`,
    'styles=',
    'format=image/png',
    'transparent=true',
    'crs=CRS:84',
    `bbox=${bbox.join(',')}`,
    `width=${width}`,
    `height=${imageHeight(region, cfg)}`,
    `time=${encodeURIComponent(observedAt)}`,
  ].join('&');
  return `${cfg.wmsBase}/${workspace}/${layer}/ows?${q}`;
}

/** Relative image route served by this function. */
export function buildImageRoute(region: RadarRegion, observedAt: string): string {
  return `?image=${region}&t=${encodeURIComponent(observedAt)}`;
}

/** Latest frame time (ISO, no millis) from WMS capabilities: the time Dimension's default, else its last value. */
export function parseCapabilitiesTime(xml: string): string | null {
  const dim = /<Dimension\b[^>]*\bname="time"[^>]*>([^<]*)<\/Dimension>/i.exec(xml);
  if (!dim) return null;
  const tag = dim[0].slice(0, dim[0].indexOf('>'));
  const def = /\bdefault="([^"]+)"/i.exec(tag)?.[1];
  const last = dim[1].split(',').map((s) => s.trim()).filter(Boolean).pop();
  for (const c of [def, last]) {
    const ms = c ? Date.parse(c) : NaN;
    if (Number.isFinite(ms)) return new Date(ms).toISOString().replace('.000Z', 'Z');
  }
  return null;
}

/** Exponential backoff after `failures` consecutive failures (0 = none). */
export function backoffMs(failures: number, cfg: RadarConfig = RADAR_CONFIG): number {
  if (failures <= 0) return 0;
  const { baseMs, factor, maxMs } = cfg.backoff;
  return Math.min(maxMs, baseMs * Math.pow(factor, failures - 1));
}

export interface RegionState {
  /** Newest frame time known (epoch ms) or null. */
  observedMs: number | null;
  /** When capabilities was last read successfully. */
  checkedAt: number | null;
  failures: number;
  /** No upstream attempt before this. */
  nextRetryAt: number;
}

export const newRegionState = (): RegionState => ({ observedMs: null, checkedAt: null, failures: 0, nextRetryAt: 0 });

/** Should we read capabilities now? Respects both the check interval and any backoff. */
export function shouldCheck(s: RegionState, now: number, cfg: RadarConfig = RADAR_CONFIG): boolean {
  if (now < s.nextRetryAt) return false;
  return s.checkedAt === null || now - s.checkedAt >= cfg.capabilitiesCheckMs;
}

/** Image refetch only when the frame is newer than the one held. */
export function needsNewImage(heldMs: number | null, frameMs: number): boolean {
  return heldMs === null || frameMs > heldMs;
}

/** stale / available rule. Unknown frame = unavailable (never "no rain"). */
export function frameStatus(
  s: RegionState,
  now: number,
  cfg: RadarConfig = RADAR_CONFIG,
): { stale: boolean; available: boolean } {
  if (s.observedMs === null) return { stale: true, available: false };
  const age = now - s.observedMs;
  return { stale: s.failures > 0 || age > cfg.staleAfterMs, available: age <= cfg.maxAgeMs };
}

/** Validates the `t` of an image request: ISO, not in the future, within the service's history. Returns normalized ISO or null. */
export function validateImageTime(t: string | null, now: number, cfg: RadarConfig = RADAR_CONFIG): string | null {
  if (!t) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  if (ms > now + cfg.futureSkewMs || ms < now - cfg.imageHistoryMs) return null;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

// ---- Service (fetch + clock injected, so it is testable without network) ----

export interface RadarDeps {
  fetchText(url: string): Promise<string>;
  fetchBytes(url: string): Promise<Uint8Array>;
  now(): number;
  cfg?: RadarConfig;
}

export interface HeldImage {
  observedAt: string;
  bytes: Uint8Array;
}

export interface ImageResult {
  bytes: Uint8Array;
  observedAt: string;
  /** True when this is a different (older/newer) held frame served because the requested one could not be fetched. */
  stale: boolean;
}

export function createRadarService(deps: RadarDeps) {
  const cfg = deps.cfg ?? RADAR_CONFIG;
  const states = new Map<RadarRegion, RegionState>();
  const images = new Map<RadarRegion, HeldImage>();
  const checks = new Map<RadarRegion, Promise<void>>();
  const fetches = new Map<string, Promise<Uint8Array>>();
  const imageBackoff = new Map<RadarRegion, { failures: number; nextRetryAt: number }>();
  const stateOf = (r: RadarRegion) => {
    let s = states.get(r);
    if (!s) states.set(r, (s = newRegionState()));
    return s;
  };

  /** Reads capabilities when due; one in-flight read per region; failures back off and keep the last frame. */
  function check(region: RadarRegion): Promise<void> {
    const s = stateOf(region);
    if (!shouldCheck(s, deps.now(), cfg)) return Promise.resolve();
    const running = checks.get(region);
    if (running) return running;
    const p = (async () => {
      try {
        const iso = parseCapabilitiesTime(await deps.fetchText(buildCapabilitiesUrl(region, cfg)));
        if (!iso) throw new Error('no time dimension');
        const ms = Date.parse(iso);
        if (s.observedMs === null || ms > s.observedMs) s.observedMs = ms;
        s.checkedAt = deps.now();
        s.failures = 0;
        s.nextRetryAt = 0;
      } catch {
        s.failures += 1;
        s.nextRetryAt = deps.now() + backoffMs(s.failures, cfg);
      } finally {
        checks.delete(region);
      }
    })();
    checks.set(region, p);
    return p;
  }

  async function getRegions(regions: RadarRegion[]): Promise<LiveRadarResponse> {
    await Promise.all(regions.map(check));
    const now = deps.now();
    return {
      attribution: cfg.attribution,
      regions: regions.map((region) => {
        const s = stateOf(region);
        const observedAt = s.observedMs === null ? null : new Date(s.observedMs).toISOString().replace('.000Z', 'Z');
        const { stale, available } = frameStatus(s, now, cfg);
        const { bbox, width } = cfg.regions[region];
        return {
          region,
          observedAt,
          bbox,
          width,
          height: imageHeight(region, cfg),
          imageUrl: observedAt && available ? buildImageRoute(region, observedAt) : null,
          stale,
          available,
        };
      }),
    };
  }

  /** PNG bytes for (region, t): held copy if it matches, else one upstream fetch; falls back to the held frame (stale). */
  async function getImage(region: RadarRegion, t: string): Promise<ImageResult | null> {
    const held = images.get(region);
    if (held && held.observedAt === t) return { ...held, stale: false };
    const bo = imageBackoff.get(region);
    if (bo && deps.now() < bo.nextRetryAt) return held ? { ...held, stale: true } : null;
    const key = `${region}|${t}`;
    let p = fetches.get(key);
    if (!p) {
      p = deps.fetchBytes(buildImageUrl(region, t, cfg));
      fetches.set(key, p);
      p.then(
        () => fetches.delete(key),
        () => fetches.delete(key),
      );
    }
    try {
      const bytes = await p;
      imageBackoff.delete(region);
      if (needsNewImage(held ? Date.parse(held.observedAt) : null, Date.parse(t))) {
        images.set(region, { observedAt: t, bytes });
      }
      return { bytes, observedAt: t, stale: false };
    } catch {
      const failures = (imageBackoff.get(region)?.failures ?? 0) + 1;
      imageBackoff.set(region, { failures, nextRetryAt: deps.now() + backoffMs(failures, cfg) });
      return held ? { ...held, stale: true } : null;
    }
  }

  return { getRegions, getImage };
}
