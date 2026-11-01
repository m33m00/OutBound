/**
 * Drive time to the airport for the Leave By card (John, 2026-11-01: "pull the estimated time to
 * drive there from your location"; he picked Apple Maps). Pure helpers shared by the live-drive-time
 * Edge Function and the app; no network or crypto here.
 *
 * Source: Apple Maps Server API `GET /v1/etas` (driving, with traffic for the departure time).
 * Docs: https://developer.apple.com/documentation/applemapsserverapi/-v1-etas
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export interface DriveTimeRequest {
  origin: LatLon;
  destination: LatLon;
  /** When you'd set off (epoch ms), so traffic is for that time. Clamped to now or later. */
  departMs: number;
}

/** What the app gets back. `available: false` means use the rough estimate. */
export type LiveDriveTimeResponse =
  | {
      available: true;
      /** Expected drive with traffic at the departure time, whole minutes. */
      minutes: number;
      /** Same trip with no traffic, whole minutes (null if Apple didn't say). */
      typicalMinutes: number | null;
      distanceKm: number;
      /** Which maps service answered, for the card's small print. */
      attribution: string;
      fetchedAt: string;
    }
  | { available: false; reason: 'not_configured' | 'no_route' | 'upstream_unavailable' };

export const DRIVE_TIME_CONFIG = {
  /** Origin is rounded to 3 decimals (about 100 m) before it leaves the server: no exact home address. */
  originDecimals: 3,
  /** Same rounded trip within this window is served from memory. */
  cacheMs: 5 * 60_000,
  /** Apple's access token lasts 30 min; renew a minute early. */
  tokenSkewMs: 60_000,
  /** Departure times further out than this aren't predicted; Apple uses "now" traffic instead. */
  maxAheadMs: 7 * 24 * 3_600_000,
  upstreamTimeoutMs: 8_000,
} as const;

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function parseLatLon(raw: string | null): LatLon | null {
  if (!raw) return null;
  const [a, b, extra] = raw.split(',');
  if (extra !== undefined) return null;
  const lat = Number(a);
  const lon = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Reads `?from=lat,lon&to=lat,lon&depart=epochMs`. Null when from or to is missing or bad. */
export function parseDriveTimeRequest(params: URLSearchParams, nowMs: number, cfg = DRIVE_TIME_CONFIG): DriveTimeRequest | null {
  const from = parseLatLon(params.get('from'));
  const to = parseLatLon(params.get('to'));
  if (!from || !to) return null;
  const d = Number(params.get('depart'));
  const departMs = Number.isFinite(d) && d > nowMs ? Math.min(d, nowMs + cfg.maxAheadMs) : nowMs;
  return {
    origin: { lat: round(from.lat, cfg.originDecimals), lon: round(from.lon, cfg.originDecimals) },
    destination: { lat: round(to.lat, 4), lon: round(to.lon, 4) },
    departMs,
  };
}

/** Cache key: rounded trip plus the departure to the nearest 15 min. */
export function driveTimeKey(r: DriveTimeRequest): string {
  const slot = Math.round(r.departMs / 900_000);
  return `${r.origin.lat},${r.origin.lon}>${r.destination.lat},${r.destination.lon}@${slot}`;
}

/** Apple Maps Server API ETA query for one destination by car. */
export function etaUrl(r: DriveTimeRequest, nowMs: number): string {
  const q = new URLSearchParams({
    origin: `${r.origin.lat},${r.origin.lon}`,
    destinations: `${r.destination.lat},${r.destination.lon}`,
    transportType: 'Automobile',
  });
  // Apple predicts traffic for a future departure; for "now" it uses current traffic.
  if (r.departMs > nowMs + 60_000) q.set('departureDate', new Date(r.departMs).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  return `https://maps-api.apple.com/v1/etas?${q.toString()}`;
}

interface AppleEta {
  distanceMeters?: number;
  expectedTravelTimeSeconds?: number;
  staticTravelTimeSeconds?: number;
}

/** Turns Apple's `{ etas: [...] }` into the app's answer. */
export function parseEtaResponse(body: unknown, fetchedAt: string): LiveDriveTimeResponse {
  const eta = (body as { etas?: AppleEta[] } | null)?.etas?.[0];
  const secs = eta?.expectedTravelTimeSeconds;
  if (!eta || typeof secs !== 'number' || !Number.isFinite(secs) || secs < 0) return { available: false, reason: 'no_route' };
  const typical = eta.staticTravelTimeSeconds;
  return {
    available: true,
    minutes: Math.max(1, Math.round(secs / 60)),
    typicalMinutes: typeof typical === 'number' && Number.isFinite(typical) ? Math.max(1, Math.round(typical / 60)) : null,
    distanceKm: Math.round(((eta.distanceMeters ?? 0) / 1000) * 10) / 10,
    attribution: 'Apple Maps',
    fetchedAt,
  };
}

/** The three secrets the function needs; null when any is missing (then the app keeps its estimate). */
export interface AppleMapsKey {
  teamId: string;
  keyId: string;
  /** The .p8 file's contents, PEM with BEGIN/END lines. */
  privateKey: string;
}

export function readAppleMapsKey(get: (k: string) => string | undefined): AppleMapsKey | null {
  const teamId = get('APPLE_MAPS_TEAM_ID')?.trim();
  const keyId = get('APPLE_MAPS_KEY_ID')?.trim();
  // Pasted keys sometimes arrive with literal "\n"; turn them back into line breaks.
  const privateKey = get('APPLE_MAPS_PRIVATE_KEY')?.replace(/\\n/g, '\n').trim();
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

/** PEM (PKCS#8) body as bytes, for WebCrypto's importKey. */
export function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const b64 = pem.replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const base64Url = (bytes: Uint8Array | string): string => {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Header and claims of the token Apple's /v1/token swaps for an access token (ES256, 1 hour). */
export function mapsTokenParts(key: AppleMapsKey, nowMs: number): { header: string; payload: string } {
  const iat = Math.floor(nowMs / 1000);
  return {
    header: base64Url(JSON.stringify({ alg: 'ES256', kid: key.keyId, typ: 'JWT' })),
    payload: base64Url(JSON.stringify({ iss: key.teamId, iat, exp: iat + 3600 })),
  };
}
