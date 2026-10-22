/**
 * Flight status (AeroDataBox): request parsing, response parsing, TTL choice, usage logging, cache orchestration, batching.
 * Pure TypeScript; only imports the config module (Deno + Jest both load it). No network here: the Edge Function
 * injects the upstream fetch and the usage store, tests inject fakes (no live calls in tests).
 * Rules: DECISIONS.md "Flight status" + Q-047 (every result row, one shared cache) + Q-049 (NO app spend cap; api_usage logging stays).
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
  /**
   * ok = served normally (see stale); not_found = provider has no such flight; unavailable = provider failed and
   * nothing cached; invalid = batch item that failed validation. ('paused' is retired by Q-049 and never sent.)
   */
  state: 'ok' | 'not_found' | 'paused' | 'unavailable' | 'invalid';
  /** Older than its cache time because the provider could not be asked. */
  stale: boolean;
  /** @deprecated Retired by Q-049 (no spend cap). Always false; kept so older UI code still type-checks. */
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

// ---------------------------------------------------------------- usage logging (no cap, Q-049)

export const monthKey = (nowMs: number): string => new Date(nowMs).toISOString().slice(0, 7);

/** Where usage rows live. The Edge Function backs this with the api_usage table; may throw (table missing). */
export interface UsageStore {
  record(row: { provider: string; endpoint: string; units: number; month: string }): Promise<void>;
}

/**
 * Logs ONE api_usage row per upstream call (never per cache hit). Never blocks or refuses a call: a missing table
 * or database error is logged once and counting continues in memory (this instance's calls only).
 */
export function createUsageTracker(store: UsageStore | null, log: (msg: string) => void = () => {}, cfg = FLIGHT_STATUS_CONFIG) {
  const mem = new Map<string, number>();
  let storeWarned = false;
  const warnStore = (e: unknown) => {
    if (storeWarned) return;
    storeWarned = true;
    log(`api_usage unavailable (${e instanceof Error ? e.message : String(e)}); counting in memory only`);
  };
  return {
    /** Units this instance has logged this month (informational only). */
    unitsThisMonth(nowMs: number): number {
      return mem.get(monthKey(nowMs)) ?? 0;
    },
    async record(nowMs: number): Promise<void> {
      const month = monthKey(nowMs);
      const units = cfg.usage.unitsPerCall;
      mem.set(month, (mem.get(month) ?? 0) + units);
      if (store) {
        try {
          await store.record({ provider: cfg.usage.provider, endpoint: cfg.usage.endpoint, units, month });
        } catch (e) {
          warnStore(e);
        }
      }
      log(`usage ${cfg.usage.provider} +${units} units, instance month ${month} ~${mem.get(month)} units`);
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

/** Cached status if fresh; otherwise one paid call (deduped); stale cache on any failure. No spend cap (Q-049). */
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
    await deps.usage.record(nowMs);
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

// ---------------------------------------------------------------- batch

/** One lookup inside a batch body: the same fields as the single-flight query string. */
export interface BatchItemInput {
  flight?: unknown;
  date?: unknown;
  from?: unknown;
  dep?: unknown;
}

export interface BatchResultItem extends FlightStatusResponse {
  /** Echo of the lookup key "AA123|2026-10-22|ORD" (same format the app's flightLookupKey builds). */
  key: string;
}

export interface BatchResponse {
  results: BatchResultItem[];
  /** Server clock when answered (ISO). */
  asOf: string;
}

/** Parses a batch body. Returns null when the body is not { flights: [...] } or is empty/over the limit. */
export function parseBatchBody(
  body: unknown,
  nowMs: number,
  cfg: FlightStatusConfig = FLIGHT_STATUS_CONFIG,
): { items: (FlightRequest | null)[] } | null {
  if (!isObj(body) || !Array.isArray(body.flights)) return null;
  if (body.flights.length === 0 || body.flights.length > cfg.batchMax) return null;
  const items = body.flights.map((raw) => {
    if (!isObj(raw)) return null;
    const p = new URLSearchParams();
    if (typeof raw.flight === 'string') p.set('flight', raw.flight);
    if (typeof raw.date === 'string') p.set('date', raw.date);
    if (typeof raw.from === 'string') p.set('from', raw.from);
    if (typeof raw.dep === 'number' || typeof raw.dep === 'string') p.set('dep', String(Math.round(Number(raw.dep))));
    return parseFlightRequest(p, nowMs, cfg);
  });
  return { items };
}

/** Per-client lookup budget (a batch of N costs N). Same fixed window as allowRequest. */
export function allowLookups(
  buckets: Map<string, { windowStart: number; count: number }>,
  key: string,
  nowMs: number,
  cost: number,
  limit: number,
): boolean {
  const b = buckets.get(key);
  if (!b || nowMs - b.windowStart >= 60_000) {
    buckets.set(key, { windowStart: nowMs, count: cost });
    return cost <= limit;
  }
  if (b.count + cost > limit) return false;
  b.count += cost;
  return true;
}

/**
 * Resolves many lookups, ONE answer per input position. Duplicates (same flight + date + origin) share one
 * resolve, so each flight costs at most one upstream call, and only when its cache entry is expired.
 */
export async function resolveFlightBatch(
  deps: ResolveDeps,
  items: readonly (FlightRequest | null)[],
  nowMs: number,
): Promise<BatchResultItem[]> {
  const cfg = deps.cfg ?? FLIGHT_STATUS_CONFIG;
  const unique = new Map<string, FlightRequest>();
  for (const r of items) if (r && !unique.has(requestKey(r))) unique.set(requestKey(r), r);
  const done = new Map<string, FlightStatusResponse>();
  const queue = [...unique.entries()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [k, r] = next;
      done.set(k, await resolveFlightStatus(deps, r, nowMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(cfg.batchConcurrency, queue.length) }, worker));
  return items.map((r): BatchResultItem => {
    if (!r) {
      return { key: '', flightNumber: '', date: '', state: 'invalid', stale: false, paused: false, fetchedAt: null, status: null };
    }
    return { key: requestKey(r), ...(done.get(requestKey(r)) as FlightStatusResponse) };
  });
}
