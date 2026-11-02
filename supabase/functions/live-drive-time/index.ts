// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET /live-drive-time?from=lat,lon&to=lat,lon&depart=epochMs  ->  LiveDriveTimeResponse
// Drive time with traffic from Apple Maps (John, 2026-11-01). Needs the secrets APPLE_MAPS_TEAM_ID,
// APPLE_MAPS_KEY_ID and APPLE_MAPS_PRIVATE_KEY; without them it answers { available: false } and the
// app keeps its rough estimate. See README.md.
import { allowRequest } from '../_shared/faaStatus.ts';
import {
  DRIVE_TIME_CONFIG as CFG,
  driveTimeKey,
  etaUrl,
  mapsTokenParts,
  parseDriveTimeRequest,
  parseEtaResponse,
  pemToBytes,
  base64Url,
  readAppleMapsKey,
  type AppleMapsKey,
  type LiveDriveTimeResponse,
} from '../_shared/driveTime.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

const buckets = new Map<string, { windowStart: number; count: number }>();
const cache = new Map<string, { at: number; body: LiveDriveTimeResponse }>();
let access: { token: string; expiresAt: number } | null = null;
let signingKey: CryptoKey | null = null;

/** Signs the ES256 token Apple swaps for a 30-minute access token. */
async function signedMapsToken(key: AppleMapsKey, nowMs: number): Promise<string> {
  signingKey ??= await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(key.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const { header, payload } = mapsTokenParts(key, nowMs);
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, data));
  return `${header}.${payload}.${base64Url(sig)}`;
}

async function accessToken(key: AppleMapsKey, nowMs: number): Promise<string> {
  if (access && access.expiresAt - CFG.tokenSkewMs > nowMs) return access.token;
  const res = await fetch('https://maps-api.apple.com/v1/token', {
    headers: { Authorization: `Bearer ${await signedMapsToken(key, nowMs)}` },
    signal: AbortSignal.timeout(CFG.upstreamTimeoutMs),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const body = (await res.json()) as { accessToken: string; expiresInSeconds: number };
  access = { token: body.accessToken, expiresAt: nowMs + body.expiresInSeconds * 1000 };
  return access.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!allowRequest(buckets, ip, Date.now())) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });

  const now = Date.now();
  const trip = parseDriveTimeRequest(new URL(req.url).searchParams, now);
  if (!trip) return json({ error: 'from_and_to_required' }, 400);

  const key = readAppleMapsKey((k) => Deno.env.get(k));
  if (!key) return json({ available: false, reason: 'not_configured' } satisfies LiveDriveTimeResponse);

  const ck = driveTimeKey(trip);
  const hit = cache.get(ck);
  if (hit && now - hit.at < CFG.cacheMs) return json(hit.body, 200, { 'Cache-Control': 'private, max-age=300' });

  try {
    let res = await fetch(etaUrl(trip, now), {
      headers: { Authorization: `Bearer ${await accessToken(key, now)}` },
      signal: AbortSignal.timeout(CFG.upstreamTimeoutMs),
    });
    if (res.status === 401) {
      // Token revoked or expired early: get a fresh one once.
      access = null;
      res = await fetch(etaUrl(trip, now), {
        headers: { Authorization: `Bearer ${await accessToken(key, now)}` },
        signal: AbortSignal.timeout(CFG.upstreamTimeoutMs),
      });
    }
    if (!res.ok) return json({ available: false, reason: 'upstream_unavailable' } satisfies LiveDriveTimeResponse);
    const body = parseEtaResponse(await res.json(), new Date(now).toISOString());
    cache.set(ck, { at: now, body });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return json(body, 200, { 'Cache-Control': 'private, max-age=300' });
  } catch {
    return json({ available: false, reason: 'upstream_unavailable' } satisfies LiveDriveTimeResponse);
  }
});
