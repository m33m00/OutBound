// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// GET /live-faa-status?airports=ORD,JFK  ->  LiveFaaStatusResponse
import {
  allowRequest,
  getSnapshot,
  parseNasXml,
  selectAirports,
  type CacheEntry,
  type LiveFaaStatusResponse,
} from '../_shared/faaStatus.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const FAA_URL = 'https://nasstatus.faa.gov/api/airport-status-information';
const state: { entry: CacheEntry | null } = { entry: null };
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

async function loadFaa() {
  const res = await fetch(FAA_URL, {
    headers: { 'User-Agent': 'OutBound/1.0 (nonrev app; contact via app owner)', Accept: 'application/xml' },
  });
  if (!res.ok) throw new Error(`FAA ${res.status}`);
  return parseNasXml(await res.text(), new Date().toISOString());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  // Supabase's gateway already verifies the anon-key JWT (verify_jwt on by default).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!allowRequest(buckets, ip, Date.now())) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });

  const codes = (new URL(req.url).searchParams.get('airports') ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{3,4}$/.test(c))
    .slice(0, 50);
  if (codes.length === 0) return json({ error: 'airports_required' }, 400);

  try {
    const r = await getSnapshot(state, Date.now(), loadFaa);
    const body: LiveFaaStatusResponse = {
      asOf: r.snapshot.asOf,
      fetchedAt: r.fetchedAt,
      stale: r.stale,
      airports: selectAirports(r.snapshot, codes),
    };
    return json(body, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return json({ error: 'upstream_unavailable' }, 502);
  }
});
