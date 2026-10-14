/**
 * Every radar number in one place (backlog 13). Pure TypeScript, NO imports (Deno and Jest both load it).
 * Source: NOAA/NWS MRMS base reflectivity (quality controlled) through the NWS GeoServer WMS (Q-031).
 * Provisional values are marked; none of them are John-decided.
 */

export type RadarRegion = 'conus' | 'ak' | 'hi' | 'carib';

export interface RadarRegionConfig {
  /** GeoServer workspace and layer, e.g. conus / conus_bref_qcd. */
  workspace: string;
  layer: string;
  /** [west, south, east, north] in degrees (lon/lat). Taken from the service's capabilities files, rounded. */
  bbox: [number, number, number, number];
  /** Requested image width in px; height follows the box's aspect (equirectangular, so 1 px = same degrees both ways). */
  width: number;
}

export interface RadarConfig {
  attribution: string;
  wmsBase: string;
  regions: Record<RadarRegion, RadarRegionConfig>;
  /** Check the WMS time dimension for a region at most this often. */
  capabilitiesCheckMs: number;
  /** Image Cache-Control max-age. */
  ttlMs: number;
  /** A frame older than this (or a failed check) is flagged stale. */
  staleAfterMs: number;
  /** A frame older than this is unavailable (overlay hidden; never implies "no rain"). */
  maxAgeMs: number;
  /** Retry delay after an upstream failure: base * factor^(failures-1), capped at max. */
  backoff: { baseMs: number; factor: number; maxMs: number };
  /** Upstream request timeout. */
  upstreamTimeoutMs: number;
  /** An `image` request's `t` must be within this far in the past (the service keeps about 2 h of frames). */
  imageHistoryMs: number;
  /** Tolerated clock skew for a future `t`. */
  futureSkewMs: number;
  /** Client poll interval bounds (the hook clamps refreshMs to this). */
  clientRefresh: { defaultMs: number; minMs: number; maxMs: number };
}

export const RADAR_CONFIG: RadarConfig = {
  attribution: 'Radar: NOAA/NWS MRMS',
  wmsBase: 'https://opengeo.ncep.noaa.gov/geoserver',
  regions: {
    conus: { workspace: 'conus', layer: 'conus_bref_qcd', bbox: [-130, 20, -60, 55], width: 1536 },
    ak: { workspace: 'alaska', layer: 'alaska_bref_qcd', bbox: [-176, 50, -126, 72], width: 1536 },
    // Small box: 1024 px is already ~79 px/deg, far finer than the 1 km data needs (provisional).
    hi: { workspace: 'hawaii', layer: 'hawaii_bref_qcd', bbox: [-164, 15, -151, 26], width: 1024 },
    carib: { workspace: 'carib', layer: 'carib_bref_qcd', bbox: [-90, 10, -60, 25], width: 1536 },
  },
  capabilitiesCheckMs: 2 * 60 * 1000,
  ttlMs: 5 * 60 * 1000,
  staleAfterMs: 10 * 60 * 1000,
  maxAgeMs: 30 * 60 * 1000,
  backoff: { baseMs: 30 * 1000, factor: 2, maxMs: 10 * 60 * 1000 },
  upstreamTimeoutMs: 8000,
  imageHistoryMs: 2.5 * 60 * 60 * 1000,
  futureSkewMs: 5 * 60 * 1000,
  clientRefresh: { defaultMs: 2 * 60 * 1000, minMs: 30 * 1000, maxMs: 10 * 60 * 1000 },
};

export const RADAR_REGIONS = Object.keys(RADAR_CONFIG.regions) as RadarRegion[];
