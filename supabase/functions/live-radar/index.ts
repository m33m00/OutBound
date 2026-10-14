// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET /live-radar?regions=conus,hi   -> LiveRadarResponse (JSON)
// GET /live-radar?image=conus&t=ISO  -> PNG bytes (pass-through from NOAA, never decoded)
import { allowRequest } from '../_shared/faaStatus.ts';
import { createRadarService, parseImageRegion, parseRegions, validateImageTime } from '../_shared/radar.ts';
import { RADAR_CONFIG } from '../_shared/radarConfig.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
};

// NWS asks for a descriptive User-Agent and polite use.
const UA = 'OutBound/1.0 (nonrev app; contact via app owner)';
const buckets = new Map<string, { windowStart: number; count: number }>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });

async function upstream(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    signal: AbortSignal.timeout(RADAR_CONFIG.upstreamTimeoutMs),
  });
  if (!res.ok) throw new Error(`noaa ${res.status}`);
  return res;
}

const service = createRadarService({
  fetchText: async (url) => await (await upstream(url, 'text/xml')).text(),
  fetchBytes: async (url) => {
    const res = await upstream(url, 'image/png');
    if (!(res.headers.get('content-type') ?? '').startsWith('image/png')) throw new Error('not a png');
    return new Uint8Array(await res.arrayBuffer());
  },
  now: () => Date.now(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!allowRequest(buckets, ip, Date.now())) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });

  const params = new URL(req.url).searchParams;
  const imageParam = params.get('image');

  if (imageParam !== null) {
    const region = parseImageRegion(imageParam);
    const t = validateImageTime(params.get('t'), Date.now());
    if (!region || !t) return json({ error: 'bad_image_request' }, 400);
    const img = await service.getImage(region, t);
    if (!img) return json({ error: 'upstream_unavailable' }, 502);
    return new Response(img.bytes, {
      headers: {
        ...CORS,
        'Content-Type': 'image/png',
        // A fallback frame is cached only briefly: it is not the frame this URL asked for.
        'Cache-Control': `public, max-age=${img.stale ? 30 : Math.round(RADAR_CONFIG.ttlMs / 1000)}`,
        'X-Observed-At': img.observedAt,
        ...(img.stale ? { 'X-Stale': 'true' } : {}),
      },
    });
  }

  const { regions, invalid } = parseRegions(params.get('regions'));
  if (regions.length === 0 || invalid.length > 0) return json({ error: 'regions_required', invalid }, 400);
  return json(await service.getRegions(regions), 200, { 'Cache-Control': 'public, max-age=60' });
});
