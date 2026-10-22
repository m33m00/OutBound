/**
 * Every flight-status number in one place. PROVISIONAL defaults (not John-decided); change them here only.
 * Pure TypeScript, NO imports (Deno and Jest both load it). Tests read these values, never hard-code them.
 */

export interface FlightStatusConfig {
  /** Server cache lifetime by time to scheduled departure. First matching row wins (rows ordered nearest first). */
  ttlTiers: { withinMs: number; ttlMs: number }[];
  /** Used when departure is further out than every tier (or unknown). */
  ttlFarMs: number;
  /** After the flight has left, status is cached this long (arrived/canceled flights barely change). */
  ttlPastMs: number;
  /** Client may not re-request the same flight sooner than this (manual refresh cooldown). */
  clientCooldownMs: number;
  /** Max entries in the in-memory server cache. */
  maxCacheEntries: number;
  /** Requests per minute per client IP (shared allowRequest). Lower than the free sources: each miss is paid. */
  rateLimitPerMin: number;
  /** Delay below this many minutes is still "scheduled" / on time when the provider says nothing else. */
  delayedAtOrAboveMin: number;
  /** After an upstream failure, do not call again for this key for this long (serve stale meanwhile). */
  failureBackoffMs: number;
  /** Accepted flight dates: this many days before / after today (blocks bulk or far-future lookups). */
  dateWindowDays: { past: number; future: number };
  /** Upstream timeout. */
  upstreamTimeoutMs: number;
  usage: {
    provider: string;
    endpoint: string;
    /** Units one flight-status call costs. PLACEHOLDER until the plan is chosen. */
    unitsPerCall: number;
    /** USD per unit. PLACEHOLDER until the plan is chosen. */
    unitPriceUsd: number;
    /** DECISIONS.md: paid-API cap $30/mo; alert at $24. */
    monthlyCapUsd: number;
    alertAtUsd: number;
  };
  upstream: {
    /** PLACEHOLDER host: RapidAPI vs API.market not chosen yet. Verify against the plan before deploy. */
    baseUrl: string;
    hostHeader: string;
  };
}

export const FLIGHT_STATUS_CONFIG: FlightStatusConfig = {
  ttlTiers: [
    { withinMs: 3 * 3_600_000, ttlMs: 15 * 60_000 },
    { withinMs: 24 * 3_600_000, ttlMs: 30 * 60_000 },
    { withinMs: 48 * 3_600_000, ttlMs: 2 * 3_600_000 },
  ],
  ttlFarMs: 6 * 3_600_000,
  ttlPastMs: 30 * 60_000,
  clientCooldownMs: 2 * 60_000,
  maxCacheEntries: 500,
  rateLimitPerMin: 20,
  delayedAtOrAboveMin: 15,
  failureBackoffMs: 30_000,
  dateWindowDays: { past: 2, future: 10 },
  upstreamTimeoutMs: 8_000,
  usage: {
    provider: 'aerodatabox',
    endpoint: 'flights/number',
    unitsPerCall: 2,
    unitPriceUsd: 0.005,
    monthlyCapUsd: 30,
    alertAtUsd: 24,
  },
  upstream: {
    baseUrl: 'https://aerodatabox.p.rapidapi.com',
    hostHeader: 'aerodatabox.p.rapidapi.com',
  },
};
