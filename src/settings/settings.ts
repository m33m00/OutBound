/**
 * Tester settings (backlog 12, Q-003, Q-024). Saved on the phone (Q-025);
 * moves to the account when login exists. Values are clamped on read so a
 * bad or old saved value can't break search.
 */
import { AIRPORTS, airportsNear, DEFAULT_SEARCH_OPTIONS, type SearchOptions } from '@/engine';

/** The search settings people can adjust (DECISIONS.md: "All adjustable"). */
export type SearchFilters = Pick<
  SearchOptions,
  | 'maxStops'
  | 'minConnectSameAirlineMin'
  | 'minConnectSwitchMin'
  | 'maxLayoverMin'
  | 'nearbyAirports'
  | 'maxGroundTransferMin'
>;

export const DEFAULT_FILTERS: SearchFilters = {
  maxStops: DEFAULT_SEARCH_OPTIONS.maxStops,
  minConnectSameAirlineMin: DEFAULT_SEARCH_OPTIONS.minConnectSameAirlineMin,
  minConnectSwitchMin: DEFAULT_SEARCH_OPTIONS.minConnectSwitchMin,
  maxLayoverMin: DEFAULT_SEARCH_OPTIONS.maxLayoverMin,
  nearbyAirports: DEFAULT_SEARCH_OPTIONS.nearbyAirports,
  maxGroundTransferMin: DEFAULT_SEARCH_OPTIONS.maxGroundTransferMin,
};

/** Stepper limits, shared by settings and the Filters panel (provisional ranges). */
export const LIMITS = {
  bufferMin: { min: 30, max: 180, step: 5 },
  minConnectSameAirlineMin: { min: 30, max: 180, step: 15 },
  minConnectSwitchMin: { min: 45, max: 240, step: 15 },
  maxLayoverMin: { min: 60, max: 720, step: 30 },
  maxGroundTransferMin: { min: 15, max: 120, step: 15 },
} as const;

/** Home airports (Q-026): one main home plus optional extras. */
export interface Homes {
  main: string | null;
  extras: string[];
}

export interface Settings {
  homes: Homes;
  /** Be at the airport this long before departure (Q-003, default 75). */
  bufferMin: number;
  /** Use phone location for the leave-by drive estimate (Q-023). */
  useLocation: boolean;
  /** Defaults the Filters panel starts from. */
  search: SearchFilters;
}

export const DEFAULT_SETTINGS: Settings = {
  homes: { main: null, extras: [] },
  bufferMin: 75,
  useLocation: false,
  search: DEFAULT_FILTERS,
};

export const SETTINGS_KEY = 'outbound.settings.v1';

function num(v: unknown, fallback: number, lim: { min: number; max: number; step: number }): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const snapped = Math.round(v / lim.step) * lim.step;
  return Math.min(lim.max, Math.max(lim.min, snapped));
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Saved JSON (or anything) -> valid Settings. */
export function parseSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (o.search && typeof o.search === 'object' ? o.search : {}) as Record<string, unknown>;
  const d = DEFAULT_FILTERS;
  const stops = typeof s.maxStops === 'number' ? Math.round(s.maxStops) : d.maxStops;
  const h = (o.homes && typeof o.homes === 'object' ? o.homes : {}) as Record<string, unknown>;
  const known = (v: unknown): v is string => typeof v === 'string' && v in AIRPORTS;
  const main = known(h.main) ? h.main : null;
  const extras = Array.isArray(h.extras)
    ? [...new Set(h.extras.filter(known))].filter((code) => code !== main)
    : [];
  return {
    homes: { main, extras },
    bufferMin: num(o.bufferMin, DEFAULT_SETTINGS.bufferMin, LIMITS.bufferMin),
    useLocation: bool(o.useLocation, DEFAULT_SETTINGS.useLocation),
    search: {
      maxStops: Math.min(3, Math.max(0, stops)),
      minConnectSameAirlineMin: num(s.minConnectSameAirlineMin, d.minConnectSameAirlineMin, LIMITS.minConnectSameAirlineMin),
      minConnectSwitchMin: num(s.minConnectSwitchMin, d.minConnectSwitchMin, LIMITS.minConnectSwitchMin),
      maxLayoverMin: num(s.maxLayoverMin, d.maxLayoverMin, LIMITS.maxLayoverMin),
      nearbyAirports: bool(s.nearbyAirports, d.nearbyAirports),
      maxGroundTransferMin: num(s.maxGroundTransferMin, d.maxGroundTransferMin, LIMITS.maxGroundTransferMin),
    },
  };
}

/** How many search filters differ from `base`. */
export function changedFilters(f: SearchFilters, base: SearchFilters = DEFAULT_FILTERS): number {
  return (Object.keys(base) as (keyof SearchFilters)[]).filter((k) => f[k] !== base[k]).length;
}

export interface HomeAirport {
  code: string;
  main: boolean;
  /** Added automatically: same nearby group as the main home (Q-026). */
  auto: boolean;
}

/** All home airports, main first, then nearby-group airports, then extras. */
export function homeAirports(homes: Homes): HomeAirport[] {
  if (!homes.main) return homes.extras.map((code) => ({ code, main: false, auto: false }));
  const out: HomeAirport[] = [{ code: homes.main, main: true, auto: false }];
  // Unlimited transfer: every airport in the main home's group counts.
  for (const [code] of airportsNear(homes.main, Infinity).slice(1)) out.push({ code, main: false, auto: true });
  for (const code of homes.extras) {
    if (!out.some((h) => h.code === code)) out.push({ code, main: false, auto: false });
  }
  return out;
}
