/**
 * Airport weather: aviationweather.gov parsing, disruption classifier, window logic, cache.
 * Pure TypeScript; only imports the config module (Deno + Jest both load it).
 * Rules: DECISIONS.md "Weather"; thresholds Q-027 live in weatherConfig.ts.
 * Sources: https://aviationweather.gov/api/data/metar and /taf (format=json, no key).
 */
import { ICAO_EXCEPTIONS, WEATHER_CONFIG, type WeatherConfig, type WeatherLevel } from './weatherConfig.ts';

export type { WeatherConfig, WeatherLevel };

// ---------------------------------------------------------------- types

export interface Conditions {
  /** Lowest BKN / OVC / vertical-visibility layer, feet; null = no ceiling (or unknown). */
  ceilingFt: number | null;
  /** Statute miles; null = not reported. */
  visSm: number | null;
  windKt: number | null;
  gustKt: number | null;
  /** Present-weather tokens, e.g. ["-RA", "BR", "VCTS"]. */
  wx: string[];
}

export interface Finding {
  level: 'caution' | 'likelyDelays';
  /** Short plain words for the UI. */
  label: string;
}

export interface Metar {
  icao: string;
  obsMs: number;
  cond: Conditions;
}

export type TafKind = 'base' | 'fm' | 'becmg' | 'tempo' | 'prob';

export interface TafPeriod {
  fromMs: number;
  toMs: number;
  kind: TafKind;
  probability: number | null;
  cond: Conditions;
}

export interface Taf {
  icao: string;
  issuedMs: number;
  validFromMs: number;
  validToMs: number;
  periods: TafPeriod[];
}

// ---------------------------------------------------------------- stations

/** IATA -> ICAO. 'K' + IATA for the contiguous US, explicit map for the rest; null if not a 3-letter code. */
export function icaoForIata(iata: string): string | null {
  const c = iata.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  return ICAO_EXCEPTIONS[c] ?? `K${c}`;
}

// ---------------------------------------------------------------- level helpers

const RANK: Record<WeatherLevel, number> = { none: 0, caution: 1, likelyDelays: 2 };
export const worseLevel = (a: WeatherLevel, b: WeatherLevel): WeatherLevel => (RANK[b] > RANK[a] ? b : a);

// ---------------------------------------------------------------- normalisation of upstream fields

/** "10+", "6+", "P6SM", "1/2", "1 1/2", "M1/4SM", 3 -> statute miles. */
export function parseVisibility(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase().replace(/SM$/, '').replace(/^[PM]/, '').replace(/\+$/, '').trim();
  if (!s) return null;
  let total = 0;
  for (const part of s.split(/\s+/)) {
    const m = part.match(/^(\d+)\/(\d+)$/);
    if (m) {
      if (Number(m[2]) === 0) return null;
      total += Number(m[1]) / Number(m[2]);
    } else if (/^\d+(\.\d+)?$/.test(part)) total += Number(part);
    else return null;
  }
  return total;
}

interface CloudLayer {
  cover?: unknown;
  base?: unknown;
}

/** Ceiling = lowest BKN / OVC / OVX(VV) layer. `vertVis` below 100 is hundreds of feet. */
export function ceilingFromClouds(clouds: unknown, vertVis?: unknown): number | null {
  let best: number | null = null;
  if (Array.isArray(clouds)) {
    for (const l of clouds as CloudLayer[]) {
      const cover = typeof l?.cover === 'string' ? l.cover.toUpperCase() : '';
      if (['BKN', 'OVC', 'OVX', 'VV'].includes(cover) && typeof l.base === 'number') {
        best = best === null ? l.base : Math.min(best, l.base);
      }
    }
  }
  if (typeof vertVis === 'number' && Number.isFinite(vertVis)) {
    const ft = vertVis < 100 ? vertVis * 100 : vertVis;
    best = best === null ? ft : Math.min(best, ft);
  }
  return best;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function conditionsFrom(o: Record<string, unknown>): Conditions {
  return {
    ceilingFt: ceilingFromClouds(o.clouds, o.vertVis),
    visSm: parseVisibility(o.visib),
    windKt: num(o.wspd),
    gustKt: num(o.wgst),
    wx: typeof o.wxString === 'string' ? o.wxString.split(/\s+/).filter(Boolean) : [],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** aviationweather.gov /api/data/metar?format=json -> newest report per ICAO id. */
export function parseMetarJson(data: unknown): Map<string, Metar> {
  const out = new Map<string, Metar>();
  if (!Array.isArray(data)) return out;
  for (const o of data) {
    if (!isObj(o) || typeof o.icaoId !== 'string' || typeof o.obsTime !== 'number') continue;
    const m: Metar = { icao: o.icaoId, obsMs: o.obsTime * 1000, cond: conditionsFrom(o) };
    const prev = out.get(m.icao);
    if (!prev || m.obsMs > prev.obsMs) out.set(m.icao, m);
  }
  return out;
}

function tafKind(change: unknown, probability: number | null): TafKind {
  const c = typeof change === 'string' ? change.toUpperCase() : '';
  if (c === 'FM') return 'fm';
  if (c === 'BECMG') return 'becmg';
  if (c === 'PROB') return 'prob';
  if (c === 'TEMPO') return 'tempo';
  if (c === '') return probability !== null ? 'prob' : 'base';
  return 'tempo'; // unknown group: treat as not prevailing
}

/** aviationweather.gov /api/data/taf?format=json -> newest TAF per ICAO id. */
export function parseTafJson(data: unknown): Map<string, Taf> {
  const out = new Map<string, Taf>();
  if (!Array.isArray(data)) return out;
  for (const o of data) {
    if (!isObj(o) || typeof o.icaoId !== 'string' || !Array.isArray(o.fcsts)) continue;
    const issued = Date.parse(String(o.issueTime ?? o.bulletinTime ?? ''));
    const from = num(o.validTimeFrom);
    const to = num(o.validTimeTo);
    if (!Number.isFinite(issued) || from === null || to === null) continue;
    const periods: TafPeriod[] = [];
    for (const f of o.fcsts) {
      if (!isObj(f)) continue;
      const pf = num(f.timeFrom);
      const pt = num(f.timeTo);
      if (pf === null || pt === null) continue;
      const probability = num(f.probability);
      periods.push({
        fromMs: pf * 1000,
        toMs: pt * 1000,
        kind: tafKind(f.fcstChange, probability),
        probability,
        cond: conditionsFrom(f),
      });
    }
    const t: Taf = { icao: o.icaoId, issuedMs: issued, validFromMs: from * 1000, validToMs: to * 1000, periods };
    const prev = out.get(t.icao);
    if (!prev || t.issuedMs > prev.issuedMs) out.set(t.icao, t);
  }
  return out;
}

// ---------------------------------------------------------------- classifier (pure)

/** Findings for one present-weather token. Intensity: '-' light, none moderate, '+' heavy. */
function wxFindings(token: string, visSm: number | null, cfg: WeatherConfig): Finding[] {
  const out: Finding[] = [];
  let t = token.toUpperCase();
  let intensity: 'light' | 'moderate' | 'heavy' = 'moderate';
  if (t.startsWith('-')) {
    intensity = 'light';
    t = t.slice(1);
  } else if (t.startsWith('+')) {
    intensity = 'heavy';
    t = t.slice(1);
  }
  if (t.startsWith('VC')) {
    if (t.includes('TS')) out.push({ level: 'caution', label: 'Thunderstorms nearby' });
    return out;
  }
  if (t.includes('TS')) out.push({ level: 'likelyDelays', label: 'Thunderstorms' });
  if (/FZ(RA|DZ)/.test(t)) {
    if (t.includes('FZRA')) out.push({ level: 'likelyDelays', label: 'Freezing rain' });
    else out.push({ level: intensity === 'light' ? 'caution' : 'likelyDelays', label: 'Freezing drizzle' });
  }
  if (t.includes('PL')) {
    out.push(
      intensity === 'heavy'
        ? { level: 'likelyDelays', label: 'Heavy ice pellets' }
        : { level: 'caution', label: 'Ice pellets' },
    );
  }
  if (t.includes('SN') || t.includes('SG')) {
    if (t.startsWith('BL')) out.push({ level: 'caution', label: 'Blowing snow' });
    else if (intensity === 'light') out.push({ level: 'caution', label: 'Light snow' });
    else out.push({ level: 'likelyDelays', label: intensity === 'heavy' ? 'Heavy snow' : 'Snow' });
  }
  if ((t.includes('FG') || t.includes('BR')) && visSm !== null && visSm < cfg.visSm.fogCautionBelow) {
    out.push({ level: 'caution', label: 'Fog' });
  }
  return out;
}

/** Classifies one set of conditions. Worst wins; calm / VFR / MVFR alone gives level 'none'. */
export function classifyConditions(
  c: Conditions,
  cfg: WeatherConfig = WEATHER_CONFIG,
): { level: WeatherLevel; findings: Finding[] } {
  const found: Finding[] = [];
  if (c.ceilingFt !== null) {
    if (c.ceilingFt < cfg.ceilingFt.likelyBelow) found.push({ level: 'likelyDelays', label: 'Low clouds' });
    else if (c.ceilingFt < cfg.ceilingFt.cautionBelow) found.push({ level: 'caution', label: 'Low clouds' });
  }
  if (c.visSm !== null) {
    if (c.visSm < cfg.visSm.likelyBelowHalf) found.push({ level: 'likelyDelays', label: 'Very low visibility' });
    else if (c.visSm < cfg.visSm.likelyBelow) found.push({ level: 'likelyDelays', label: 'Low visibility' });
    else if (c.visSm < cfg.visSm.cautionBelow) found.push({ level: 'caution', label: 'Low visibility' });
  }
  if (c.gustKt !== null && c.gustKt >= cfg.windKt.gustCautionAtOrAbove) {
    found.push({
      level: c.gustKt >= cfg.windKt.gustLikelyAtOrAbove ? 'likelyDelays' : 'caution',
      label: `Gusts ${Math.round(c.gustKt)} kt`,
    });
  } else if (c.windKt !== null && c.windKt >= cfg.windKt.sustainedCautionAtOrAbove) {
    found.push({ level: 'caution', label: `Strong wind ${Math.round(c.windKt)} kt` });
  }
  for (const tok of c.wx) found.push(...wxFindings(tok, c.visSm, cfg));

  const seen = new Set<string>();
  const findings = found
    .filter((f) => (seen.has(f.label) ? false : (seen.add(f.label), true)))
    .sort((a, b) => RANK[b.level] - RANK[a.level]);
  const level: WeatherLevel = findings.length ? findings[0].level : 'none';
  return { level, findings };
}

// ---------------------------------------------------------------- per-station evaluation

export type WeatherState = 'ok' | 'noForecast' | 'noData';

export interface WeatherRaw {
  ceilingFt: number | null;
  visSm: number | null;
  windKt: number | null;
  gustKt: number | null;
}

export interface StationWeather {
  /** `${station}:${windowStart}:${windowEnd}` - echo of the request. */
  key: string;
  station: string;
  icao: string;
  windowStart: number;
  windowEnd: number;
  /**
   * ok = classified; noForecast = we have data for the airport but none covering the window
   * (beyond the TAF, "no forecast yet"); noData = unknown airport / no reports. Level is 'none' unless ok.
   */
  state: WeatherState;
  level: WeatherLevel;
  /** Short plain words, worst first. Empty when level is 'none'. */
  reasons: string[];
  /** When the METAR used was observed (ISO); null if no METAR was used. */
  observedAt: string | null;
  /** When the TAF used was issued (ISO); null if no forecast was used. */
  issuedAt: string | null;
  /** Oldest of observedAt / issuedAt: the age to show ("updated 4m ago"). */
  asOf: string | null;
  /** Values behind the worst reading (or the latest reading when calm). */
  raw: WeatherRaw | null;
  /** True when any data used came from an older cache because aviationweather.gov failed. */
  stale: boolean;
}

export interface WeatherRequest {
  station: string;
  /** UTC epoch ms. */
  fromMs: number;
  toMs: number;
}

export const weatherKey = (r: WeatherRequest): string => `${r.station}:${r.fromMs}:${r.toMs}`;

const rawOf = (c: Conditions): WeatherRaw => ({
  ceilingFt: c.ceilingFt,
  visSm: c.visSm,
  windKt: c.windKt,
  gustKt: c.gustKt,
});

interface Evaluation {
  level: WeatherLevel;
  findings: Finding[];
  cond: Conditions;
}

/** TEMPO / PROB groups are not prevailing: capped at cfg.temporaryMaxLevel and labelled "(possible)". */
function evaluatePeriod(p: TafPeriod, cfg: WeatherConfig): Evaluation {
  const r = classifyConditions(p.cond, cfg);
  const temporary = p.kind === 'tempo' || p.kind === 'prob' || p.probability !== null;
  if (!temporary) return { ...r, cond: p.cond };
  const findings = r.findings.map<Finding>((f) => ({
    level: RANK[f.level] > RANK[cfg.temporaryMaxLevel] ? cfg.temporaryMaxLevel : f.level,
    label: `${f.label} (possible)`,
  }));
  return { level: findings.length ? findings.reduce<WeatherLevel>((a, f) => worseLevel(a, f.level), 'none') : 'none', findings, cond: p.cond };
}

const iso = (ms: number) => new Date(ms).toISOString();

export interface EvaluateInput {
  request: WeatherRequest;
  nowMs: number;
  metar: Metar | null;
  taf: Taf | null;
  stale: boolean;
}

/**
 * Worst of: (a) TAF periods overlapping the window, (b) the latest METAR when the window starts
 * within cfg.metarHorizonMs of now. FM/base/BECMG count as prevailing (BECMG from the start of its
 * change); TEMPO / PROB count at most as Caution. Window outside the TAF's valid period -> noForecast.
 */
export function evaluateStation(input: EvaluateInput, cfg: WeatherConfig = WEATHER_CONFIG): StationWeather {
  const { request, nowMs, metar, taf, stale } = input;
  const ws = Math.min(request.fromMs, request.toMs);
  const we = Math.max(request.fromMs, request.toMs);
  const evals: Evaluation[] = [];
  const asOfCandidates: number[] = [];
  let observedAt: string | null = null;
  let issuedAt: string | null = null;

  const useMetar =
    metar !== null && we >= nowMs && ws - nowMs <= cfg.metarHorizonMs && nowMs - metar.obsMs <= cfg.metarMaxAgeMs;
  if (useMetar && metar) {
    evals.push({ ...classifyConditions(metar.cond, cfg), cond: metar.cond });
    observedAt = iso(metar.obsMs);
    asOfCandidates.push(metar.obsMs);
  }

  let covered = false;
  if (taf && ws < taf.validToMs && we > taf.validFromMs) {
    const hit = taf.periods.filter((p) => p.fromMs <= we && p.toMs > ws);
    if (hit.length) {
      covered = true;
      for (const p of hit) evals.push(evaluatePeriod(p, cfg));
      issuedAt = iso(taf.issuedMs);
      asOfCandidates.push(taf.issuedMs);
    }
  }

  const icao = icaoForIata(request.station) ?? request.station;
  const base = {
    key: weatherKey(request),
    station: request.station,
    icao,
    windowStart: request.fromMs,
    windowEnd: request.toMs,
    stale,
  };

  if (!useMetar && !covered) {
    return {
      ...base,
      state: metar || taf ? 'noForecast' : 'noData',
      level: 'none',
      reasons: [],
      observedAt: null,
      issuedAt: null,
      asOf: null,
      raw: null,
      stale: false,
    };
  }

  let level: WeatherLevel = 'none';
  for (const e of evals) level = worseLevel(level, e.level);
  const findings = evals.flatMap((e) => e.findings).sort((a, b) => RANK[b.level] - RANK[a.level]);
  const reasons = [...new Set(findings.map((f) => f.label))];
  const driver = evals.find((e) => e.level === level) ?? evals[0];
  return {
    ...base,
    state: 'ok',
    level,
    reasons,
    observedAt,
    issuedAt,
    asOf: iso(Math.min(...asOfCandidates)),
    raw: driver ? rawOf(driver.cond) : null,
  };
}

// ---------------------------------------------------------------- request parsing

/**
 * `stations=ORD:1760400000000:1760407200000,JFK` -> requests. A bare code means "now to +2 h".
 * Bad entries are dropped; capped at cfg.maxRequestsPerCall.
 */
export function parseWeatherRequests(
  param: string | null,
  nowMs: number,
  cfg: WeatherConfig = WEATHER_CONFIG,
): WeatherRequest[] {
  const out: WeatherRequest[] = [];
  const seen = new Set<string>();
  for (const entry of (param ?? '').split(',')) {
    const [codeRaw, fromRaw, toRaw] = entry.trim().split(':');
    const station = (codeRaw ?? '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(station)) continue;
    let fromMs = nowMs;
    let toMs = nowMs + 2 * 60 * 60 * 1000;
    if (fromRaw !== undefined) {
      fromMs = Number(fromRaw);
      toMs = toRaw !== undefined ? Number(toRaw) : fromMs;
      if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) continue;
    }
    const r = { station, fromMs: Math.round(fromMs), toMs: Math.round(toMs) };
    const k = weatherKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= cfg.maxRequestsPerCall) break;
  }
  return out;
}

// ---------------------------------------------------------------- server cache (per ICAO, serve stale on error)

export interface BatchCache<T> {
  map: Map<string, { value: T | null; fetchedAtMs: number }>;
}

export const newBatchCache = <T>(): BatchCache<T> => ({ map: new Map() });

export interface BatchResult<T> {
  values: Map<string, T>;
  /** Ids served from an expired entry because the refresh failed. */
  staleIds: Set<string>;
  /** The upstream call failed (stale data may still be served). */
  failed: boolean;
}

/** Fetches only ids that are missing or expired, in ONE batched call. Misses are cached as null. */
export async function getCachedBatch<T>(
  cache: BatchCache<T>,
  ids: readonly string[],
  nowMs: number,
  ttlMs: number,
  load: (ids: string[]) => Promise<Map<string, T>>,
  maxEntries: number = WEATHER_CONFIG.maxCacheEntries,
): Promise<BatchResult<T>> {
  const need = ids.filter((id) => {
    const e = cache.map.get(id);
    return !e || nowMs - e.fetchedAtMs >= ttlMs;
  });
  const staleIds = new Set<string>();
  let failed = false;
  if (need.length) {
    try {
      const loaded = await load(need);
      for (const id of need) cache.map.set(id, { value: loaded.get(id) ?? null, fetchedAtMs: nowMs });
    } catch {
      failed = true;
      for (const id of need) if (cache.map.has(id)) staleIds.add(id);
    }
    if (cache.map.size > maxEntries) {
      const oldest = [...cache.map.entries()].sort((a, b) => a[1].fetchedAtMs - b[1].fetchedAtMs);
      for (const [id] of oldest.slice(0, cache.map.size - maxEntries)) cache.map.delete(id);
    }
  }
  const values = new Map<string, T>();
  for (const id of ids) {
    const v = cache.map.get(id)?.value;
    if (v) values.set(id, v);
  }
  return { values, staleIds, failed };
}

// ---------------------------------------------------------------- response

export interface LiveWeatherResponse {
  /** When this response was built. */
  fetchedAt: string;
  /** True when any result used older cached data because aviationweather.gov failed. */
  stale: boolean;
  results: StationWeather[];
}

export function buildWeatherResponse(
  requests: readonly WeatherRequest[],
  metars: BatchResult<Metar>,
  tafs: BatchResult<Taf>,
  nowMs: number,
  cfg: WeatherConfig = WEATHER_CONFIG,
): LiveWeatherResponse {
  const results = requests.map((request) => {
    const icao = icaoForIata(request.station) ?? '';
    const metar = metars.values.get(icao) ?? null;
    const taf = tafs.values.get(icao) ?? null;
    const stale = (metar !== null && metars.staleIds.has(icao)) || (taf !== null && tafs.staleIds.has(icao));
    return evaluateStation({ request, nowMs, metar, taf, stale }, cfg);
  });
  return { fetchedAt: iso(nowMs), stale: results.some((r) => r.stale), results };
}
