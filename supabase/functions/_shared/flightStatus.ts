/**
 * Flight status (AeroDataBox): request parsing, response parsing, TTL choice, spend-cap logic, cache orchestration.
 * Pure TypeScript; only imports the config module (Deno + Jest both load it). No network here: the Edge Function
 * injects the upstream fetch and the usage store, tests inject fakes (no live calls in tests).
 * Rules: DECISIONS.md "Flight status" (opened flights only), paid-API cap $30/mo with alert at $24.
 * Upstream shape (AeroDataBox FlightContract, from public docs; verify against a real response once the key exists):
 *   GET /flights/number/{number}/{localDate} -> array of { number, status, departure, arrival, lastUpdatedUtc }
 *   movement = { airport:{iata}, scheduledTime:{utc}, revisedTime:{utc}, predictedTime:{utc}, runwayTime:{utc}, terminal, gate }
 */
import { FLIGHT_STATUS_CONFIG, type FlightStatusConfig } from './flightStatusConfig.ts';

export type { FlightStatusConfig };

// ---------------------------------------------------------------- contract

export type FlightState = 'scheduled' | 'delayed' | 'departed' | 'arrived' | 'canceled' | 'diverted';

export interface Movement {
  airport: string | null;
  /** ISO UTC, or null when the provider has none. */
  scheduledUtc: string | null;
  estimatedUtc: string | null;
  actualUtc: string | null;
  /** Minutes late vs scheduled using actual, else estimated; negative = early; null = unknown. */
  delayMin: number | null;
  terminal: string | null;
  gate: string | null;
}

export interface FlightStatus {
  flightNumber: string;
  state: FlightState;
  departure: Movement;
  arrival: Movement;
  /** The provider's own last-update time (ISO), when it gives one. */
  providerUpdatedAt: string | null;
}

export interface FlightRequest {
  /** Normalised, no spaces: "AA123". */
  flightNumber: string;
  /** Local departure date, YYYY-MM-DD. */
  date: string;
  /** Departure airport IATA; picks the right leg when a number flies several. */
  from: string | null;
  /** Scheduled departure, UTC epoch ms, when the app knows it (used only to pick the cache time). */
  departMs: number | null;
}

export interface FlightStatusResponse {
  flightNumber: string;
  date: string;
  /** ok = served normally (see stale); paused = spend cap reached; not_found = provider has no such flight. */
  state: 'ok' | 'not_found' | 'paused' | 'unavailable';
  /** Older than its cache time because the provider could not be asked (error or paused). */
  stale: boolean;
  paused: boolean;
  /** When we last got this from the provider (ISO); the age shown to the user. Null if never. */
  fetchedAt: string | null;
  status: FlightStatus | null;
}

// ---------------------------------------------------------------- request parsing

const FLIGHT_RE = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseFlightRequest(
  params: URLSearchParams,
  nowMs: number,
  cfg: FlightStatusConfig = FLIGHT_STATUS_CONFIG,
): FlightRequest | null {
  const flightNumber = (params.get('flight') ?? '').replace(/\s+/g, '').toUpperCase();
  if (!FLIGHT_RE.test(flightNumber)) return null;
  const date = params.get('date') ?? '';
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const dayMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(dayMs) || new Date(dayMs).toISOString().slice(0, 10) !== date) return null;
  const day = 86_400_000;
  // The local date can be a day off UTC either way, so allow one extra day on each side of the window.
  if (dayMs < nowMs - (cfg.dateWindowDays.past + 1) * day || dayMs > nowMs + (cfg.dateWindowDays.future + 1) * day) {
    return null;
  }
  const fromRaw = (params.get('from') ?? '').trim().toUpperCase();
  const from = /^[A-Z]{3}$/.test(fromRaw) ? fromRaw : null;
  const depRaw = params.get('dep');
  const dep = depRaw != null && /^\d{10,14}$/.test(depRaw) ? Number(depRaw) : null;
  return { flightNumber, date, from, departMs: dep };
}

export const requestKey = (r: FlightRequest): string => `${r.flightNumber}|${r.date}|${r.from ?? ''}`;

// ---------------------------------------------------------------- upstream parsing

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** AeroDataBox times look like "2026-10-22 14:05Z"; returns ISO or null. */
export function parseProviderTime(v: unknown): string | null {
  const raw = isObj(v) ? v.utc : v;
  const s = str(raw);
  if (!s) return null;
  const ms = Date.parse(s.replace(' ', 'T'));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const IN_AIR_OR_DONE = new Set(['departed', 'enroute', 'approaching', 'arrived']);

function parseMovement(raw: unknown, departed: boolean, arrived: boolean, side: 'dep' | 'arr'): Movement {
  const m = isObj(raw) ? raw : {};
  const airport = isObj(m.airport) ? str(m.airport.iata) : null;
  const scheduledUtc = parseProviderTime(m.scheduledTime);
  const revised = parseProviderTime(m.revisedTime) ?? parseProviderTime(m.predictedTime);
  const runway = parseProviderTime(m.runwayTime);
  const happened = side === 'dep' ? departed : arrived;
  const actualUtc = happened ? (runway ?? null) : null;
  const estimatedUtc = revised ?? (happened ? null : runway);
  const ref = actualUtc ?? estimatedUtc;
  const delayMin = scheduledUtc && ref ? Math.round((Date.parse(ref) - Date.parse(scheduledUtc)) / 60_000) : null;
  return { airport, scheduledUtc, estimatedUtc, actualUtc, delayMin, terminal: str(m.terminal), gate: str(m.gate) };
}

export function mapState(providerStatus: unknown, depDelay: number | null, arrDelay: number | null, cfg = FLIGHT_STATUS_CONFIG): FlightState {
  const s = (str(providerStatus) ?? '').toLowerCase();
  if (s === 'canceled' || s === 'canceleduncertain') return 'canceled';
  if (s === 'diverted') return 'diverted';
  if (s === 'arrived') return 'arrived';
  if (s === 'departed' || s === 'enroute' || s === 'approaching') return 'departed';
  if (s === 'delayed') return 'delayed';
  const worst = Math.max(depDelay ?? 0, arrDelay ?? 0);
  return worst >= cfg.delayedAtOrAboveMin ? 'delayed' : 'scheduled';
}

/** Picks the matching flight from the provider array (by departure airport when given) and normalises it. */
export function parseFlightStatus(body: unknown, req: FlightRequest, cfg = FLIGHT_STATUS_CONFIG): FlightStatus | null {
  const list = Array.isArray(body) ? body.filter(isObj) : isObj(body) ? [body] : [];
  if (list.length === 0) return null;
  const depIata = (f: Obj) => (isObj(f.departure) && isObj(f.departure.airport) ? str(f.departure.airport.iata) : null);
  const f = (req.from ? list.find((x) => depIata(x)?.toUpperCase() === req.from) : list[0]) ?? null;
  if (!f) return null;
  const ps = (str(f.status) ?? '').toLowerCase();
  const departed = IN_AIR_OR_DONE.has(ps);
  const arrived = ps === 'arrived';
  const departure = parseMovement(f.departure, departed, arrived, 'dep');
  const arrival = parseMovement(f.arrival, departed, arrived, 'arr');
  return {
    flightNumber: req.flightNumber,
    state: mapState(f.status, departure.delayMin, arrival.delayMin, cfg),
    departure,
    arrival,
    providerUpdatedAt: parseProviderTime(f.lastUpdatedUtc),
  };
}

// ---------------------------------------------------------------- cache time

/**
 * How long a fetched status stays fresh. Nearer departure = shorter. Never runs past the moment the flight
 * crosses into a nearer (shorter) tier, so a status fetched 49 h out is rechecked at 48 h.
 */
export function cacheExpiry(
  nowMs: number,
  departMs: number | null,
  state: FlightState | null,
  cfg: FlightStatusConfig = FLIGHT_STATUS_CONFIG,
): number {
  if (departMs == null) return nowMs + cfg.ttlFarMs;
  const until = departMs - nowMs;
  if (until <= 0) {
    return nowMs + (state === 'arrived' || state === 'canceled' ? cfg.ttlPastMs : cfg.ttlTiers[0].ttlMs);
  }
  const tier = cfg.ttlTiers.find((t) => until < t.withinMs);
  let expires = nowMs + (tier ? tier.ttlMs : cfg.ttlFarMs);
  for (const t of cfg.ttlTiers) {
    const boundary = departMs - t.withinMs;
    if (boundary > nowMs) expires = Math.min(expires, boundary);
  }
  return expires;
}

// ---------------------------------------------------------------- spend cap

export type CapState = 'ok' | 'alert' | 'paused';

export const monthKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 7);

/** Cap check for the NEXT call given units already used this month. */
export function capState(unitsUsed: number, cfg: FlightStatusConfig = FLIGHT_STATUS_CONFIG): { state: CapState; spentUsd: number } {
  const u = cfg.usage;
  const spentUsd = unitsUsed * u.unitPriceUsd;
  // Compare in whole units so float noise (29.99 + 0.01) cannot flip a boundary.
  const capUnits = Math.floor(u.monthlyCapUsd / u.unitPriceUsd + 1e-9);
  const alertUnits = Math.ceil(u.alertAtUsd / u.unitPriceUsd - 1e-9);
  if (unitsUsed + u.unitsPerCall > capUnits) return { state: 'paused', spentUsd };
  if (unitsUsed >= alertUnits) return { state: 'alert', spentUsd };
  return { state: 'ok', spentUsd };
}

/** Where usage rows live. The Edge Function backs this with the api_usage table; may throw (table missing). */
export interface UsageStore {
  monthUnits(provider: string, month: string): Promise<number>;
  record(row: { provider: string; endpoint: string; units: number; month: string }): Promise<void>;
}

/**
 * Month usage with an in-memory floor, so a missing table or database error never breaks status.
 * Without the table the count only covers this instance's calls (a lower bound); the log says so.
 */
export function createUsageTracker(store: UsageStore | null, log: (msg: string) => void = () => {}, cfg = FLIGHT_STATUS_CONFIG) {
  const mem = new Map<string, number>();
  const alerted = new Set<string>();
  let storeWarned = false;
  const warnStore = (e: unknown) => {
    if (storeWarned) return;
    storeWarned = true;
    log(`api_usage unavailable (${e instanceof Error ? e.message : String(e)}); counting in memory only`);
  };
  return {
    async unitsThisMonth(nowMs: number): Promise<number> {
      const month = monthKey(nowMs);
      let stored = 0;
      if (store) {
        try {
          stored = await store.monthUnits(cfg.usage.provider, month);
        } catch (e) {
          warnStore(e);
        }
      }
      return Math.max(stored, mem.get(month) ?? 0);
    },
    async record(nowMs: number, knownUnits: number): Promise<void> {
      const month = monthKey(nowMs);
      const units = cfg.usage.unitsPerCall;
      mem.set(month, Math.max(knownUnits, mem.get(month) ?? 0) + units);
      if (store) {
        try {
          await store.record({ provider: cfg.usage.provider, endpoint: cfg.usage.endpoint, units, month });
        } catch (e) {
          warnStore(e);
        }
      }
      const after = capState(mem.get(month)!, cfg);
      log(`usage ${cfg.usage.provider} +${units} units, month ${month} ~${mem.get(month)} units ($${after.spentUsd.toFixed(2)})`);
      if (after.state !== 'ok' && !alerted.has(month)) {
        alerted.add(month);
        log(`WARNING ${cfg.usage.provider} spend $${after.spentUsd.toFixed(2)} reached the $${cfg.usage.alertAtUsd} alert (cap $${cfg.usage.monthlyCapUsd})`);
      }
    },
  };
}
export type UsageTracker = ReturnType<typeof createUsageTracker>;

// ---------------------------------------------------------------- orchestration

interface CacheEntry {
  status: FlightStatus | null;
  fetchedAtMs: number;
  expiresMs: number;
}

export interface FlightCache {
  entries: Map<string, CacheEntry>;
  inflight: Map<string, Promise<FlightStatusResponse>>;
  failedAt: Map<string, number>;
}
export const newFlightCache = (): FlightCache => ({ entries: new Map(), inflight: new Map(), failedAt: new Map() });

export interface UpstreamResult {
  /** HTTP status of the provider reply. */
  status: number;
  body: unknown;
}

export interface ResolveDeps {
  cache: FlightCache;
  usage: UsageTracker;
  /** The one place a paid call happens. May throw on network errors. */
  fetchUpstream(req: FlightRequest): Promise<UpstreamResult>;
  log?: (msg: string) => void;
  cfg?: FlightStatusConfig;
}

function respond(req: FlightRequest, e: CacheEntry | undefined, o: Partial<FlightStatusResponse>): FlightStatusResponse {
  return {
    flightNumber: req.flightNumber,
    date: req.date,
    state: 'ok',
    stale: false,
    paused: false,
    fetchedAt: e ? new Date(e.fetchedAtMs).toISOString() : null,
    status: e?.status ?? null,
    ...o,
  };
}

function trim(cache: FlightCache, max: number) {
  while (cache.entries.size > max) cache.entries.delete(cache.entries.keys().next().value as string);
}

/** Cached status if fresh; otherwise one paid call (deduped), unless the cap is reached; stale cache on any failure. */
export async function resolveFlightStatus(deps: ResolveDeps, req: FlightRequest, nowMs: number): Promise<FlightStatusResponse> {
  const cfg = deps.cfg ?? FLIGHT_STATUS_CONFIG;
  const key = requestKey(req);
  const { cache } = deps;
  const hit = cache.entries.get(key);
  if (hit && nowMs < hit.expiresMs) {
    return hit.status ? respond(req, hit, {}) : respond(req, hit, { state: 'not_found' });
  }
  const pending = cache.inflight.get(key);
  if (pending) return pending;

  const run = async (): Promise<FlightStatusResponse> => {
    const staleOr = (o: Partial<FlightStatusResponse>) =>
      respond(req, hit, hit ? { stale: true, ...o } : o);

    const failedAt = cache.failedAt.get(key);
    if (failedAt != null && nowMs - failedAt < cfg.failureBackoffMs) {
      return staleOr(hit ? {} : { state: 'unavailable' });
    }

    const units = await deps.usage.unitsThisMonth(nowMs);
    if (capState(units, cfg).state === 'paused') {
      deps.log?.(`flight status paused: month cap $${cfg.usage.monthlyCapUsd} reached`);
      return staleOr({ state: 'paused', paused: true });
    }

    let up: UpstreamResult;
    try {
      up = await deps.fetchUpstream(req);
    } catch (e) {
      cache.failedAt.set(key, nowMs);
      deps.log?.(`flight status upstream error: ${e instanceof Error ? e.message : String(e)}`);
      return staleOr(hit ? {} : { state: 'unavailable' });
    }
    if (up.status !== 200 && up.status !== 404) {
      cache.failedAt.set(key, nowMs);
      deps.log?.(`flight status upstream ${up.status}`);
      return staleOr(hit ? {} : { state: 'unavailable' });
    }

    cache.failedAt.delete(key);
    await deps.usage.record(nowMs, units);
    const status = up.status === 200 ? parseFlightStatus(up.body, req, cfg) : null;
    const departMs = status?.departure.scheduledUtc ? Date.parse(status.departure.scheduledUtc) : req.departMs;
    const entry: CacheEntry = { status, fetchedAtMs: nowMs, expiresMs: cacheExpiry(nowMs, departMs, status?.state ?? null, cfg) };
    cache.entries.delete(key);
    cache.entries.set(key, entry);
    trim(cache, cfg.maxCacheEntries);
    return status ? respond(req, entry, {}) : respond(req, entry, { state: 'not_found' });
  };

  const p = run().finally(() => cache.inflight.delete(key));
  cache.inflight.set(key, p);
  return p;
}
