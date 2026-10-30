// Deno Edge Function. Excluded from the app's tsc (see tsconfig.json).
// POST /sync-schedules?days=0,1,7&airports=DAL,DFW   header x-sync-secret: <SCHEDULE_SYNC_SECRET>   ->  SyncSummary
//   Pulls AeroDataBox FIDS departures for each airport-day into flight_schedules (backlog 25). Called once a day by
//   pg_cron (see README), or by hand with ?days=0-7 to fill the whole search range. Never callable with just the anon
//   key: every run costs upstream units. Key stays in the AERODATABOX_API_KEY secret. Pure logic: ../_shared/schedules.ts.
import type { UsageStore } from '../_shared/flightStatus.ts';
import { SCHEDULE_CONFIG as CFG } from '../_shared/scheduleConfig.ts';
import { parseAirports, parseDays, planPull, runSync, type ScheduleRow, type ScheduleStore } from '../_shared/schedules.ts';

declare const Deno: {
  serve(h: (req: Request) => Response | Promise<Response>): void;
  env: { get(k: string): string | undefined };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const log = (m: string) => console.log(`[sync-schedules] ${m}`);

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const call = async (path: string, init: RequestInit) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}`);
  };
  const store: ScheduleStore = {
    async replaceDay(origin: string, localDate: string, rows: ScheduleRow[], pulledAt: string) {
      if (rows.length) {
        await call('flight_schedules?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      }
      const q = `origin=eq.${origin}&local_date=eq.${localDate}&pulled_at=lt.${encodeURIComponent(pulledAt)}`;
      await call(`flight_schedules?${q}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
    async pruneBefore(beforeDate: string) {
      await call(`flight_schedules?local_date=lt.${beforeDate}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    },
  };
  const usage: UsageStore = {
    async record(row) {
      await call('api_usage', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    },
  };
  return { store, usage };
}

async function fetchUpstream(path: string) {
  const key = Deno.env.get('AERODATABOX_API_KEY');
  if (!key) throw new Error('AERODATABOX_API_KEY not set');
  const res = await fetch(`${CFG.upstream.baseUrl}${path}`, {
    headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': CFG.upstream.hostHeader, Accept: 'application/json' },
    signal: AbortSignal.timeout(CFG.upstreamTimeoutMs),
  });
  if (res.status !== 200) return { status: res.status, body: null };
  return { status: 200, body: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('SCHEDULE_SYNC_SECRET');
  if (!secret) return json({ error: 'sync_not_configured' }, 503);
  if (req.headers.get('x-sync-secret') !== secret) return json({ error: 'forbidden' }, 403);
  if (!Deno.env.get('AERODATABOX_API_KEY')) return json({ error: 'aerodatabox_key_missing' }, 503);
  const backend = db();
  if (!backend) return json({ error: 'database_not_configured' }, 503);

  const params = new URL(req.url).searchParams;
  const days = parseDays(params.get('days'));
  if (!days) return json({ error: `days_must_be_0_to_${CFG.maxDayOffset}` }, 400);
  const airports = parseAirports(params.get('airports'));
  if (!airports) return json({ error: 'unknown_airport' }, 400);

  const now = Date.now();
  const plan = planPull(now, days, airports);
  log(`pulling ${plan.length} airport-days (${plan.length * CFG.windows.length} calls)`);
  const summary = await runSync(
    { fetchUpstream, store: backend.store, usage: backend.usage, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log },
    plan,
    now,
  );
  log(`done: ${summary.calls} calls, ${summary.daysSaved} days, ${summary.rowsSaved} rows, ${summary.failed.length} failed`);
  return json(summary, summary.failed.length && !summary.daysSaved ? 502 : 200);
});
