/**
 * Schedule DB (backlog 25): daily AeroDataBox FIDS pulls into `flight_schedules`, and the read side the app's search uses.
 * Pure TypeScript; imports only config and the shared AeroDataBox helpers (Deno + Jest both load it). No network here:
 * the Edge Functions inject the upstream fetch and the database store, tests inject fakes (no live calls in tests).
 * Rule: DECISIONS.md "Search": own schedule DB from daily AeroDataBox pulls, no live calls per search.
 * Upstream shape (AeroDataBox AirportFidsContract, from public docs; verify against a real response once the key exists):
 *   GET /flights/airports/iata/{code}/{fromLocal}/{toLocal}?withLeg=true&direction=Departure...  (window <= 12 h)
 *   -> { departures: [{ number, status, codeshareStatus, isCargo, airline:{iata},
 *        departure:{ scheduledTime:{utc,local} }, arrival:{ airport:{iata}, scheduledTime:{utc,local} } }] }
 *   204 = no flights in the window.
 */
import { monthKey, parseProviderTime, type UsageStore } from './flightStatus.ts';
import { SCHEDULE_CONFIG, type ScheduleConfig } from './scheduleConfig.ts';

export type { ScheduleConfig };

// ---------------------------------------------------------------- contract

/** One stored flight leg (a `flight_schedules` row). Times are ISO UTC. */
export interface ScheduleRow {
  /** Same id rule as the engine: airline + number + origin-local date + origin, e.g. "WN311-2026-10-30-DAL". */
  id: string;
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  depart_utc: string;
  arrive_utc: string;
  /** Departure date at the origin, "YYYY-MM-DD". */
  local_date: string;
  pulled_at: string;
}

/** A flight as the app's engine wants it (src/engine Flight). Times are UTC epoch ms. */
export interface ScheduleFlight {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departUtc: number;
  arriveUtc: number;
}

/** GET /live-schedules response. */
export interface LiveSchedulesResponse {
  airport: string;
  fromUtc: number;
  toUtc: number;
  flights: ScheduleFlight[];
  /** Newest pull time among the returned rows (ISO), null when there are none. The age to show. */
  pulledAt: string | null;
  asOf: string;
}

// ---------------------------------------------------------------- dates

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" plus n days (calendar math, no time zone). */
export function addDaysIso(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Local calendar date at `nowMs` in `tz`. */
export function localDateIn(nowMs: number, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(nowMs))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

// ---------------------------------------------------------------- pull plan

/** "0-7", "0,1,7" or "3" -> sorted day offsets; null if any part is bad or past `maxDayOffset`. */
export function parseDays(raw: string | null, cfg: ScheduleConfig = SCHEDULE_CONFIG): number[] | null {
  if (raw === null || raw.trim() === '') return [...cfg.dailyDays];
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (b < a || b > cfg.maxDayOffset) return null;
    for (let d = a; d <= b; d++) out.add(d);
  }
  return [...out].sort((x, y) => x - y);
}

/** "DAL,dfw" -> configured airports in config order; null if any code is unknown. Empty/missing = all. */
export function parseAirports(raw: string | null, cfg: ScheduleConfig = SCHEDULE_CONFIG) {
  if (raw === null || raw.trim() === '') return [...cfg.airports];
  const want = new Set(raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean));
  const known = cfg.airports.filter((a) => want.has(a.code));
  return known.length === want.size ? known : null;
}

export interface PullDay {
  airport: string;
  tz: string;
  /** Local date at the airport. */
  date: string;
}

/** One entry per airport per requested day, dates in each airport's own calendar. */
export function planPull(nowMs: number, days: readonly number[], airports = SCHEDULE_CONFIG.airports): PullDay[] {
  return airports.flatMap((a) => {
    const today = localDateIn(nowMs, a.tz);
    return days.map((d) => ({ airport: a.code, tz: a.tz, date: addDaysIso(today, d) }));
  });
}

/** Upstream path for one FIDS window (departures only, operating flights, passenger, both ends' times). */
export function fidsPath(airport: string, date: string, window: { from: string; to: string }): string {
  const q = 'withLeg=true&direction=Departure&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false';
  return `/flights/airports/iata/${airport}/${date}T${window.from}/${date}T${window.to}?${q}`;
}

// ---------------------------------------------------------------- upstream parsing

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const IATA_AIRLINE = /^[A-Z0-9]{2}$/;

/** "WN 1234" + airline "WN" -> { airline: "WN", flightNumber: "1234" }; null if it can't be split. */
export function splitFlightNumber(number: unknown, airlineIata: unknown): { airline: string; flightNumber: string } | null {
  const n = str(number)?.toUpperCase().replace(/\s+/g, '');
  if (!n) return null;
  const a = str(airlineIata)?.toUpperCase();
  if (a && IATA_AIRLINE.test(a) && n.startsWith(a) && /^\d{1,4}[A-Z]?$/.test(n.slice(a.length))) {
    return { airline: a, flightNumber: n.slice(a.length) };
  }
  const m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(n);
  return m ? { airline: m[1], flightNumber: m[2] } : null;
}

/**
 * FIDS departures from `origin` -> rows. Keeps operating passenger flights to airports in `known` with both
 * scheduled times; canceled flights stay (live status tags them, Q-047). Duplicates (same id) keep the first.
 */
export function parseFidsDepartures(
  body: unknown,
  origin: string,
  known: ReadonlySet<string>,
  fallbackDate: string,
  pulledAtIso: string,
  cfg: ScheduleConfig = SCHEDULE_CONFIG,
): ScheduleRow[] {
  const list = isObj(body) && Array.isArray(body.departures) ? body.departures : [];
  const rows = new Map<string, ScheduleRow>();
  for (const item of list) {
    if (!isObj(item) || item.isCargo === true || item.codeshareStatus === 'IsCodeshared') continue;
    const dep = isObj(item.departure) ? item.departure : {};
    const arr = isObj(item.arrival) ? item.arrival : {};
    const destination = str(isObj(arr.airport) ? arr.airport.iata : null)?.toUpperCase();
    if (!destination || destination === origin || !known.has(destination)) continue;
    const departIso = parseProviderTime(dep.scheduledTime);
    const arriveIso = parseProviderTime(arr.scheduledTime);
    if (!departIso || !arriveIso) continue;
    const blockMin = (Date.parse(arriveIso) - Date.parse(departIso)) / 60_000;
    if (!(blockMin > 0 && blockMin <= cfg.maxBlockMin)) continue;
    const num = splitFlightNumber(item.number, isObj(item.airline) ? item.airline.iata : null);
    if (!num) continue;
    const localRaw = str(isObj(dep.scheduledTime) ? dep.scheduledTime.local : null)?.slice(0, 10);
    const localDate = localRaw && DATE_RE.test(localRaw) ? localRaw : fallbackDate;
    const id = `${num.airline}${num.flightNumber}-${localDate}-${origin}`;
    if (rows.has(id)) continue;
    rows.set(id, {
      id,
      airline: num.airline,
      flight_number: num.flightNumber,
      origin,
      destination,
      depart_utc: departIso,
      arrive_utc: arriveIso,
      local_date: localDate,
      pulled_at: pulledAtIso,
    });
  }
  return [...rows.values()];
}

// ---------------------------------------------------------------- sync orchestration

export interface UpstreamResult {
  status: number;
  body: unknown;
}

export interface ScheduleStore {
  /**
   * Replace one airport-day: upsert `rows`, then delete that origin + local date's rows pulled before `pulledAt`
   * (flights the airline dropped). Only called when every window of the day came back.
   */
  replaceDay(origin: string, localDate: string, rows: ScheduleRow[], pulledAt: string): Promise<void>;
  /** Delete rows whose local date is before `beforeDate`. */
  pruneBefore(beforeDate: string): Promise<void>;
}

export interface SyncDeps {
  fetchUpstream(path: string): Promise<UpstreamResult>;
  store: ScheduleStore;
  usage: UsageStore | null;
  sleep(ms: number): Promise<void>;
  log(msg: string): void;
}

export interface SyncSummary {
  /** Upstream calls made (each costs units). */
  calls: number;
  /** Airport-days fully replaced. */
  daysSaved: number;
  rowsSaved: number;
  /** "DAL 2026-10-30: <reason>" for days left as they were. */
  failed: string[];
}

/**
 * Pulls every planned airport-day window by window, one call at a time with a gap between calls.
 * A day is saved only when all its windows succeeded (200, or 204 = none); otherwise the old rows stay.
 * Each upstream call that got an answer logs one api_usage row (no spend cap, Q-049).
 */
export async function runSync(
  deps: SyncDeps,
  plan: readonly PullDay[],
  nowMs: number,
  cfg: ScheduleConfig = SCHEDULE_CONFIG,
): Promise<SyncSummary> {
  const known = new Set(cfg.airports.map((a) => a.code));
  const pulledAt = new Date(nowMs).toISOString();
  const summary: SyncSummary = { calls: 0, daysSaved: 0, rowsSaved: 0, failed: [] };
  let usageWarned = false;

  for (const day of plan) {
    const rows: ScheduleRow[] = [];
    let failure: string | null = null;
    for (const w of cfg.windows) {
      if (summary.calls > 0) await deps.sleep(cfg.callGapMs);
      let res: UpstreamResult;
      try {
        summary.calls++;
        res = await deps.fetchUpstream(fidsPath(day.airport, day.date, w));
      } catch (e) {
        failure = `network ${e instanceof Error ? e.message : String(e)}`;
        break;
      }
      if (deps.usage) {
        try {
          await deps.usage.record({
            provider: cfg.usage.provider,
            endpoint: cfg.usage.endpoint,
            units: cfg.usage.unitsPerCall,
            month: monthKey(nowMs),
          });
        } catch (e) {
          if (!usageWarned) deps.log(`api_usage unavailable (${e instanceof Error ? e.message : String(e)})`);
          usageWarned = true;
        }
      }
      if (res.status === 204) continue;
      if (res.status !== 200) {
        failure = `upstream ${res.status}`;
        break;
      }
      rows.push(...parseFidsDepartures(res.body, day.airport, known, day.date, pulledAt, cfg));
    }
    if (failure) {
      summary.failed.push(`${day.airport} ${day.date}: ${failure}`);
      continue;
    }
    // Windows meet at noon, so a noon departure can appear twice; keep one.
    const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
    try {
      await deps.store.replaceDay(day.airport, day.date, unique, pulledAt);
      summary.daysSaved++;
      summary.rowsSaved += unique.length;
    } catch (e) {
      summary.failed.push(`${day.airport} ${day.date}: store ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  try {
    await deps.store.pruneBefore(addDaysIso(new Date(nowMs).toISOString().slice(0, 10), -cfg.keepPastDays));
  } catch (e) {
    deps.log(`prune failed (${e instanceof Error ? e.message : String(e)})`);
  }
  return summary;
}

// ---------------------------------------------------------------- read side

export interface ReadQuery {
  airport: string;
  fromUtc: number;
  toUtc: number;
}

/** ?airport=DAL&from=<ms>&to=<ms>. Window must be inside the pulled range and no wider than maxReadWindowMs. */
export function parseReadQuery(params: URLSearchParams, nowMs: number, cfg: ScheduleConfig = SCHEDULE_CONFIG): ReadQuery | null {
  const airport = params.get('airport')?.trim().toUpperCase() ?? '';
  if (!cfg.airports.some((a) => a.code === airport)) return null;
  const fromUtc = Number(params.get('from'));
  const toUtc = Number(params.get('to'));
  if (!Number.isFinite(fromUtc) || !Number.isFinite(toUtc) || toUtc <= fromUtc) return null;
  if (toUtc - fromUtc > cfg.maxReadWindowMs) return null;
  if (fromUtc < nowMs - (cfg.keepPastDays + 1) * DAY_MS) return null;
  if (toUtc > nowMs + (cfg.maxDayOffset + 4) * DAY_MS) return null;
  return { airport, fromUtc, toUtc };
}

/** Database rows -> app flights, sorted by departure. Rows with bad times are dropped. */
export function rowsToFlights(rows: readonly Partial<ScheduleRow>[]): ScheduleFlight[] {
  const out: ScheduleFlight[] = [];
  for (const r of rows) {
    const departUtc = Date.parse(r.depart_utc ?? '');
    const arriveUtc = Date.parse(r.arrive_utc ?? '');
    if (!r.id || !r.airline || !r.flight_number || !r.origin || !r.destination) continue;
    if (!Number.isFinite(departUtc) || !Number.isFinite(arriveUtc)) continue;
    out.push({ id: r.id, airline: r.airline, flightNumber: r.flight_number, from: r.origin, to: r.destination, departUtc, arriveUtc });
  }
  return out.sort((a, b) => a.departUtc - b.departUtc || (a.id < b.id ? -1 : 1));
}

/** Newest pulled_at among rows, or null. */
export function newestPull(rows: readonly Partial<ScheduleRow>[]): string | null {
  let best: string | null = null;
  for (const r of rows) if (r.pulled_at && (!best || r.pulled_at > best)) best = r.pulled_at;
  return best;
}

/** Small expiring cache for the read endpoint (one entry per airport + window). */
export function newReadCache<T>(cfg: ScheduleConfig = SCHEDULE_CONFIG) {
  const map = new Map<string, { value: T; expires: number }>();
  return {
    get(key: string, nowMs: number): T | undefined {
      const e = map.get(key);
      if (!e) return undefined;
      if (e.expires <= nowMs) {
        map.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key: string, value: T, nowMs: number) {
      if (map.size >= cfg.maxReadCacheEntries) map.delete(map.keys().next().value as string);
      map.set(key, { value, expires: nowMs + cfg.readCacheMs });
    },
    get size() {
      return map.size;
    },
  };
}

export const readCacheKey = (q: ReadQuery): string => `${q.airport}|${q.fromUtc}|${q.toUtc}`;
