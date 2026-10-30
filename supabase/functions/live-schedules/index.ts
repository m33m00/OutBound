// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET /live-schedules?airport=DAL&from=<UTC ms>&to=<UTC ms>  ->  LiveSchedulesResponse
//   Departures stored by sync-schedules (backlog 25), for the app's search engine (one read per airport per search).
//   Reads our own table only, never AeroDataBox, so it costs no upstream units. Anon key + rate limit (Q-017).
import { allowRequest } from '../_shared/faaStatus.ts';
import { SCHEDULE_CONFIG as CFG } from '../_shared/scheduleConfig.ts';
import {
  newestPull,
  newReadCache,
  parseReadQuery,
  readCacheKey,
  rowsToFlights,
  type LiveSchedulesResponse,
  type ScheduleRow,
} from '../_shared/schedules.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const cache = newReadCache<LiveSchedulesResponse>();
const buckets = new Map<string, { windowStart: number; count: number }>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });

const COLUMNS = 'id,airline,flight_number,origin,destination,depart_utc,arrive_utc,pulled_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  if (!allowRequest(buckets, ip, now, CFG.readRateLimitPerMin)) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  }
  const q = parseReadQuery(new URL(req.url).searchParams, now);
  if (!q) return json({ error: 'airport_from_to_required' }, 400);

  const key = readCacheKey(q);
  const hit = cache.get(key, now);
  if (hit) return json(hit, 200, { 'Cache-Control': 'private, max-age=300' });

  const url = Deno.env.get('SUPABASE_URL');
  const sk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !sk) return json({ error: 'database_not_configured' }, 503);
  const from = encodeURIComponent(new Date(q.fromUtc).toISOString());
  const to = encodeURIComponent(new Date(q.toUtc).toISOString());
  const path = `flight_schedules?select=${COLUMNS}&origin=eq.${q.airport}&depart_utc=gte.${from}&depart_utc=lt.${to}&order=depart_utc&limit=5000`;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: sk, Authorization: `Bearer ${sk}` } });
  if (!res.ok) {
    console.log(`[live-schedules] read ${res.status}`);
    return json({ error: 'database_unavailable' }, 502);
  }
  const rows = (await res.json()) as Partial<ScheduleRow>[];
  const body: LiveSchedulesResponse = {
    airport: q.airport,
    fromUtc: q.fromUtc,
    toUtc: q.toUtc,
    flights: rowsToFlights(rows),
    pulledAt: newestPull(rows),
    asOf: new Date(now).toISOString(),
  };
  cache.set(key, body, now);
  return json(body, 200, { 'Cache-Control': 'private, max-age=300' });
});
