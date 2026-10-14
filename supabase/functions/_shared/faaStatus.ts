/**
 * FAA NAS status: parser, level mapping, cache and rate limiter.
 * Pure TypeScript with NO imports, so Deno (Edge Function) and Jest (app repo) both load it.
 * Source: https://nasstatus.faa.gov/api/airport-status-information (XML, no key).
 */

export type AirportStatusLevel = 'caution' | 'likelyDelays';
export type FaaEventType = 'groundStop' | 'groundDelay' | 'closure' | 'delay';

export interface FaaEvent {
  type: FaaEventType;
  reason: string;
  /** Longest delay quoted by the FAA, in minutes (delay / groundDelay only). */
  maxMinutes?: number;
  /** 'arrival' | 'departure' for general delays. */
  direction?: string;
  trend?: string;
  /** Free text from the FAA, e.g. "8:15 pm EDT" (ground stop) or "Oct 17 at 13:15 UTC." (closure). */
  endsAt?: string;
}

export interface AirportStatus {
  code: string;
  level: AirportStatusLevel;
  events: FaaEvent[];
}

export interface FaaSnapshot {
  /** FAA's own Update_Time, ISO string (or fetch time if unparseable). */
  asOf: string;
  /** Every airport with an active event, keyed by code. */
  airports: Record<string, AirportStatus>;
}

/** PROVISIONAL (DECISIONS 2026-10-14): general delays at/over this many minutes count as likelyDelays. */
export const GENERAL_DELAY_LIKELY_MINUTES = 60;

/** The one place the FAA-event -> badge mapping lives. */
export function levelForEvent(e: FaaEvent): AirportStatusLevel {
  switch (e.type) {
    case 'groundStop':
    case 'groundDelay':
    case 'closure':
      return 'likelyDelays';
    case 'delay':
      return (e.maxMinutes ?? 0) >= GENERAL_DELAY_LIKELY_MINUTES ? 'likelyDelays' : 'caution';
  }
}

export function levelForEvents(events: readonly FaaEvent[]): AirportStatusLevel {
  return events.some((e) => levelForEvent(e) === 'likelyDelays') ? 'likelyDelays' : 'caution';
}

// ---- Closure classification (Q-030) ----

/** A NOTAM-style phrase meaning the whole airport is closed ("AD AP CLSD" = aerodrome/airport closed). */
export const FULL_CLOSURE_MARKERS: readonly RegExp[] = [/\bAD\s+AP\s+CLSD\b/i, /\bAIRPORT\s+CLSD\b/i];

/**
 * Closed to ALL aircraft counts as a full closure even with an exception (e.g. "EXC MEDEVAC"):
 * scheduled air carriers are still shut out. Checked before the restriction patterns.
 */
export const CLOSED_TO_ALL: readonly RegExp[] = [/\bCLSD\s+TO\s+ALL\s+(?:ACFT|AIRCRAFT|TRAFFIC|OPS|OPNS)\b/i];

/**
 * Qualifiers meaning this is a restriction, not a full closure (scheduled air carrier ops continue).
 * Any match -> NOT a full closure. Conservative: when in doubt, do not badge.
 */
export const CLOSURE_RESTRICTION_PATTERNS: readonly RegExp[] = [
  /\bCLSD\s+TO\b/i, // closed to a class of aircraft/users
  /\bNON\s*SKED\b/i,
  /\bTRANSIENT\b/i,
  /\bGA\b/i,
  /\bPPR\b/i,
  /\bEXC(?:EPT)?\b/i, // exempts some operations
  /\bRWY\b/i,
  /\bTWY\b/i,
  /\bAPRON\b/i,
  /\bRAMP\b/i,
];

/** True only when the FAA text says the whole airport is closed to scheduled ops. */
export function isFullAirportClosure(reason: string): boolean {
  if (!FULL_CLOSURE_MARKERS.some((re) => re.test(reason))) return false;
  if (CLOSED_TO_ALL.some((re) => re.test(reason))) return true;
  return !CLOSURE_RESTRICTION_PATTERNS.some((re) => re.test(reason));
}

// ---- XML parsing (tiny, dependency-free; the FAA feed is flat and regular) ----

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? decode(m[1]) : undefined;
}

function blocks(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/** "45 minutes", "1 hour and 5 minutes", "2 hours 10 minutes" -> minutes. */
export function parseMinutes(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const h = /(\d+)\s*h(?:ou)?rs?/i.exec(text);
  const m = /(\d+)\s*min/i.exec(text);
  if (!h && !m) return undefined;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** "Wed Oct 14 05:22:14 2026 GMT" -> ISO, or undefined. */
export function parseFaaTime(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = /([A-Za-z]{3})\s+(\d{1,2})\s+(\d\d):(\d\d):(\d\d)\s+(\d{4})/.exec(text);
  if (!m || !(m[1] in MONTHS)) return undefined;
  const d = new Date(Date.UTC(+m[6], MONTHS[m[1]], +m[2], +m[3], +m[4], +m[5]));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function parseNasXml(xml: string, fetchedAtIso: string): FaaSnapshot {
  const events = new Map<string, FaaEvent[]>();
  const add = (code: string | undefined, e: FaaEvent) => {
    if (!code) return;
    const key = code.trim().toUpperCase();
    const list = events.get(key) ?? [];
    list.push(e);
    events.set(key, list);
  };

  for (const dt of blocks(xml, 'Delay_type')) {
    const name = (tag(dt, 'Name') ?? '').toLowerCase();

    if (name.includes('ground stop')) {
      for (const p of blocks(dt, 'Program')) {
        add(tag(p, 'ARPT'), { type: 'groundStop', reason: tag(p, 'Reason') ?? '', endsAt: tag(p, 'End_Time') });
      }
    } else if (name.includes('ground delay')) {
      for (const g of blocks(dt, 'Ground_Delay')) {
        add(tag(g, 'ARPT'), {
          type: 'groundDelay',
          reason: tag(g, 'Reason') ?? '',
          maxMinutes: parseMinutes(tag(g, 'Max')) ?? parseMinutes(tag(g, 'Avg')),
        });
      }
    } else if (name.includes('closure')) {
      for (const a of blocks(dt, 'Airport')) {
        if (!isFullAirportClosure(tag(a, 'Reason') ?? '')) continue; // Q-030: restrictions are not badged
        add(tag(a, 'ARPT'), { type: 'closure', reason: tag(a, 'Reason') ?? '', endsAt: tag(a, 'Reopen') });
      }
    } else if (name.includes('arrival') || name.includes('departure')) {
      for (const d of blocks(dt, 'Delay')) {
        const arpt = tag(d, 'ARPT');
        const re = /<Arrival_Departure\s+Type="([^"]*)"\s*>([\s\S]*?)<\/Arrival_Departure>/g;
        let m: RegExpExecArray | null;
        let any = false;
        while ((m = re.exec(d))) {
          any = true;
          add(arpt, {
            type: 'delay',
            reason: tag(d, 'Reason') ?? '',
            direction: m[1].toLowerCase(),
            maxMinutes: parseMinutes(tag(m[2], 'Max')) ?? parseMinutes(tag(m[2], 'Min')),
            trend: tag(m[2], 'Trend'),
          });
        }
        if (!any) add(arpt, { type: 'delay', reason: tag(d, 'Reason') ?? '' });
      }
    }
  }

  const airports: Record<string, AirportStatus> = {};
  for (const [code, list] of events) {
    airports[code] = { code, level: levelForEvents(list), events: list };
  }
  return { asOf: parseFaaTime(tag(xml, 'Update_Time')) ?? fetchedAtIso, airports };
}

export function selectAirports(snap: FaaSnapshot, codes: readonly string[]): Record<string, AirportStatus> {
  const out: Record<string, AirportStatus> = {};
  for (const c of codes) {
    const k = c.trim().toUpperCase();
    if (snap.airports[k]) out[k] = snap.airports[k];
  }
  return out;
}

// ---- Server cache (serve stale on upstream error) ----

/** Config value: server cache TTL (provisional 5 min). */
export const FAA_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CacheEntry {
  snapshot: FaaSnapshot;
  fetchedAtMs: number;
}

export interface CachedResult {
  snapshot: FaaSnapshot;
  fetchedAt: string;
  stale: boolean;
}

/** Returns a fresh-enough snapshot, refetching when expired; falls back to stale data on error. */
export async function getSnapshot(
  state: { entry: CacheEntry | null },
  nowMs: number,
  load: () => Promise<FaaSnapshot>,
  ttlMs: number = FAA_CACHE_TTL_MS,
): Promise<CachedResult> {
  const e = state.entry;
  if (e && nowMs - e.fetchedAtMs < ttlMs) {
    return { snapshot: e.snapshot, fetchedAt: new Date(e.fetchedAtMs).toISOString(), stale: false };
  }
  try {
    const snapshot = await load();
    state.entry = { snapshot, fetchedAtMs: nowMs };
    return { snapshot, fetchedAt: new Date(nowMs).toISOString(), stale: false };
  } catch (err) {
    if (e) return { snapshot: e.snapshot, fetchedAt: new Date(e.fetchedAtMs).toISOString(), stale: true };
    throw err;
  }
}

// ---- Simple fixed-window rate limiter (per key, in-memory per isolate) ----

export const RATE_LIMIT_PER_MIN = 60;

export function allowRequest(
  buckets: Map<string, { windowStart: number; count: number }>,
  key: string,
  nowMs: number,
  limit: number = RATE_LIMIT_PER_MIN,
): boolean {
  const b = buckets.get(key);
  if (!b || nowMs - b.windowStart >= 60_000) {
    buckets.set(key, { windowStart: nowMs, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

// ---- Response contract ----

export interface LiveFaaStatusResponse {
  /** FAA's own timestamp for the data. */
  asOf: string;
  /** When our server last fetched it. */
  fetchedAt: string;
  /** True when the FAA was unreachable and this is older cached data. */
  stale: boolean;
  /** Only requested airports that have an active event; absent = no FAA event. */
  airports: Record<string, AirportStatus>;
}
