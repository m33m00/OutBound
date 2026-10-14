// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET /live-weather?stations=ORD:1760400000000:1760407200000,JFK  ->  LiveWeatherResponse
//   (each station is an IATA code with an optional window in UTC epoch ms; no window = now to +2 h)
import { allowRequest } from '../_shared/faaStatus.ts';
import {
  buildWeatherResponse,
  getCachedBatch,
  icaoForIata,
  newBatchCache,
  parseMetarJson,
  parseTafJson,
  parseWeatherRequests,
  type Metar,
  type Taf,
} from '../_shared/weather.ts';
import { WEATHER_CONFIG } from '../_shared/weatherConfig.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const AWC = 'https://aviationweather.gov/api/data';
// aviationweather.gov asks for a custom User-Agent; limit is 100 req/min overall (we send 2 per cache miss).
const UA = 'OutBound/1.0 (nonrev app; contact via app owner)';
const metarCache = newBatchCache<Metar>();
const tafCache = newBatchCache<Taf>();
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

async function awc(path: string): Promise<unknown> {
  const res = await fetch(`${AWC}/${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`aviationweather ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!allowRequest(buckets, ip, Date.now())) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });

  const now = Date.now();
  const requests = parseWeatherRequests(new URL(req.url).searchParams.get('stations'), now);
  if (requests.length === 0) return json({ error: 'stations_required' }, 400);

  const icaos = [...new Set(requests.map((r) => icaoForIata(r.station)).filter((c): c is string => c !== null))];
  const [metars, tafs] = await Promise.all([
    getCachedBatch(metarCache, icaos, now, WEATHER_CONFIG.cacheMs.metar, async (ids) =>
      parseMetarJson(await awc(`metar?ids=${ids.join(',')}&format=json&hours=${WEATHER_CONFIG.metarLookbackHours}`)),
    ),
    getCachedBatch(tafCache, icaos, now, WEATHER_CONFIG.cacheMs.taf, async (ids) =>
      parseTafJson(await awc(`taf?ids=${ids.join(',')}&format=json`)),
    ),
  ]);
  // Both sources down and nothing cached: say so rather than claiming "no weather".
  if (metars.failed && tafs.failed && metars.values.size === 0 && tafs.values.size === 0) {
    return json({ error: 'upstream_unavailable' }, 502);
  }
  return json(buildWeatherResponse(requests, metars, tafs, now), 200, { 'Cache-Control': 'public, max-age=60' });
});
