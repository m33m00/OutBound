/**
 * Every schedule-DB number in one place (backlog 25). PROVISIONAL defaults (not John-decided); change them here only.
 * Pure TypeScript, NO imports (Deno and Jest both load it). Tests read these values, never hard-code them.
 * Rule: DECISIONS.md "Search": own schedule DB from daily AeroDataBox pulls, no live calls per search.
 */

export interface ScheduleAirport {
  code: string;
  /** IANA zone; FIDS windows are in the airport's local time. */
  tz: string;
}

export interface ScheduleConfig {
  /**
   * Airports pulled. Must match the app's airport table (src/engine/airports.ts AIRPORTS); a test checks it.
   * Only flights between two of these are stored, because the app can only draw and search airports it knows.
   */
  airports: ScheduleAirport[];
  /** Local dates pulled on a normal daily run, as days from today at each airport (0 = today). */
  dailyDays: number[];
  /** Largest day offset a run may ask for (search is 0-7 days out). */
  maxDayOffset: number;
  /** FIDS windows per local day, "HH:mm" start/end. AeroDataBox allows at most 12 h per call. */
  windows: { from: string; to: string }[];
  /** Pause between upstream calls (be polite; also keeps us under the plan's per-second limit). */
  callGapMs: number;
  /** Drop stored flights whose local date is this many days before today. */
  keepPastDays: number;
  /** Longest believable leg; anything longer is a parse problem and is skipped. */
  maxBlockMin: number;
  /** Read endpoint (live-schedules): widest window one request may ask for. */
  maxReadWindowMs: number;
  /** Read endpoint: server cache lifetime per airport + window. */
  readCacheMs: number;
  /** Read endpoint: max cache entries. */
  maxReadCacheEntries: number;
  /** Read endpoint: HTTP requests per minute per client IP. One search reads up to one window per airport. */
  readRateLimitPerMin: number;
  /** Upstream timeout. */
  upstreamTimeoutMs: number;
  usage: {
    provider: string;
    endpoint: string;
    /** Units one FIDS call costs. PLACEHOLDER until read from the plan page at signup. */
    unitsPerCall: number;
  };
  upstream: {
    /** Same placeholder host as flight status (RapidAPI vs API.market not chosen yet). */
    baseUrl: string;
    hostHeader: string;
  };
}

export const SCHEDULE_CONFIG: ScheduleConfig = {
  airports: [
    { code: 'ATL', tz: 'America/New_York' },
    { code: 'BNA', tz: 'America/Chicago' },
    { code: 'CLT', tz: 'America/New_York' },
    { code: 'DAL', tz: 'America/Chicago' },
    { code: 'DEN', tz: 'America/Denver' },
    { code: 'DFW', tz: 'America/Chicago' },
    { code: 'LAX', tz: 'America/Los_Angeles' },
    { code: 'LGA', tz: 'America/New_York' },
    { code: 'MIA', tz: 'America/New_York' },
    { code: 'ORD', tz: 'America/Chicago' },
    { code: 'PHX', tz: 'America/Phoenix' },
    { code: 'SEA', tz: 'America/Los_Angeles' },
  ],
  // Today and tomorrow change most (cancellations, swaps); day 7 is the new day entering the search range.
  // A first run (or a missed day) uses ?days=0-7 to fill everything.
  dailyDays: [0, 1, 7],
  maxDayOffset: 7,
  windows: [
    { from: '00:00', to: '12:00' },
    { from: '12:00', to: '23:59' },
  ],
  callGapMs: 1_100,
  keepPastDays: 2,
  maxBlockMin: 20 * 60,
  maxReadWindowMs: 5 * 86_400_000,
  readCacheMs: 10 * 60_000,
  maxReadCacheEntries: 500,
  readRateLimitPerMin: 60,
  upstreamTimeoutMs: 15_000,
  usage: {
    provider: 'aerodatabox',
    endpoint: 'flights/airports',
    unitsPerCall: 2,
  },
  upstream: {
    baseUrl: 'https://aerodatabox.p.rapidapi.com',
    hostHeader: 'aerodatabox.p.rapidapi.com',
  },
};
