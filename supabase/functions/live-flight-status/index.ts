// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET  /live-flight-status?flight=AA123&date=2026-10-22&from=ORD&dep=1760400000000  ->  FlightStatusResponse
// POST /live-flight-status  { flights: [{flight,date,from,dep}, ...up to 40] }       ->  { results: [{key, ...FlightStatusResponse}], asOf }
//   Every result row (Q-047). One shared cache per flight + date + origin; each flight costs one upstream call per
//   TTL. No spend cap (Q-049); every upstream call logs one api_usage row. Key stays in the AERODATABOX_API_KEY secret. Never called in tests; the pure logic is in ../_shared/flightStatus.ts.
import { allowRequest } from '../_shared/faaStatus.ts';
import {
  createUsageTracker,
  newFlightCache,
  allowLookups,
  parseBatchBody,
  parseFlightRequest,
  resolveFlightBatch,
  resolveFlightStatus,
  type FlightRequest,
  type UsageStore,
} from '../_shared/flightStatus.ts';
import { FLIGHT_STATUS_CONFIG as CFG } from '../_shared/flightStatusConfig.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const cache = newFlightCache();
const buckets = new Map<string, { windowStart: number; count: number }>();
const lookupBuckets = new Map<string, { windowStart: number; count: number }>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });

/** api_usage via PostgREST with the service role (both env vars are provided by Supabase). Null if not set. */
function usageStore(): UsageStore | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return {
    async record(row) {
      const res = await fetch(`${url}/rest/v1/api_usage`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(`api_usage write ${res.status}`);
    },
  };
}

const usage = createUsageTracker(usageStore(), (m) => console.log(`[live-flight-status] ${m}`));

async function fetchUpstream(req: FlightRequest) {
  const key = Deno.env.get('AERODATABOX_API_KEY');
  if (!key) throw new Error('AERODATABOX_API_KEY not set');
  const url = `${CFG.upstream.baseUrl}/flights/number/${encodeURIComponent(req.flightNumber)}/${req.date}?withAircraftImage=false&withLocation=false`;
  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': CFG.upstream.hostHeader, Accept: 'application/json' },
    signal: AbortSignal.timeout(CFG.upstreamTimeoutMs),
  });
  if (res.status !== 200) return { status: res.status, body: null };
  return { status: 200, body: await res.json() };
}

const log = (m: string) => console.log(`[live-flight-status] ${m}`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  if (!allowRequest(buckets, ip, now, CFG.rateLimitPerMin)) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const deps = { cache, usage, fetchUpstream, log };

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const parsed = parseBatchBody(body, now);
    if (!parsed) return json({ error: 'flights_array_1_to_' + CFG.batchMax }, 400);
    if (!allowLookups(lookupBuckets, ip, now, parsed.items.length, CFG.lookupsPerMin)) {
      return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
    }
    const results = await resolveFlightBatch(deps, parsed.items, now);
    return json({ results, asOf: new Date().toISOString() }, 200, { 'Cache-Control': 'private, max-age=60' });
  }

  if (!allowLookups(lookupBuckets, ip, now, 1, CFG.lookupsPerMin)) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const fr = parseFlightRequest(new URL(req.url).searchParams, now);
  if (!fr) return json({ error: 'flight_and_date_required' }, 400);

  const out = await resolveFlightStatus(deps, fr, now);
  if (out.state === 'unavailable') return json({ error: 'upstream_unavailable' }, 502);
  return json(out, 200, { 'Cache-Control': 'private, max-age=60' });
});
