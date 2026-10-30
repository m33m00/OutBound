/**
 * Tester settings (backlog 12, Q-003, Q-024). Saved on the phone (Q-025);
 * moves to the account when login exists. Values are clamped on read so a
 * bad or old saved value can't break search.
 */
import { AIRPORTS, areaFor, DEFAULT_SEARCH_OPTIONS, type SearchOptions } from '@/engine';

/**
 * The search settings people can adjust (DECISIONS.md: "All adjustable").
 * The old "Nearby airports" switch and "Longest ground transfer" stepper are
 * gone (Q-048, Q-052): areas replace them. Old saved values are ignored.
 */
export type SearchFilters = Pick<
  SearchOptions,
  'maxStops' | 'minConnectSameAirlineMin' | 'minConnectSwitchMin' | 'maxLayoverMin'
>;

export const DEFAULT_FILTERS: SearchFilters = {
  maxStops: DEFAULT_SEARCH_OPTIONS.maxStops,
  minConnectSameAirlineMin: DEFAULT_SEARCH_OPTIONS.minConnectSameAirlineMin,
  minConnectSwitchMin: DEFAULT_SEARCH_OPTIONS.minConnectSwitchMin,
  maxLayoverMin: DEFAULT_SEARCH_OPTIONS.maxLayoverMin,
};

/** Stepper limits, shared by settings and the Filters panel (provisional ranges). */
export const LIMITS = {
  bufferMin: { min: 30, max: 180, step: 5 },
  minConnectSameAirlineMin: { min: 30, max: 180, step: 15 },
  minConnectSwitchMin: { min: 45, max: 240, step: 15 },
  maxLayoverMin: { min: 60, max: 720, step: 30 },
} as const;

/** Home airports (Q-026): one main home plus optional extras. */
export interface Homes {
  main: string | null;
  extras: string[];
}

/**
 * Push notifications (DECISIONS.md: requests push to same-airline testers,
 * max 5 a day, mutable, and to the requester on answer). Design round 35.
 */
export interface NotifySettings {
  /** When someone answers your request. */
  answers: boolean;
  /** When someone asks about your airline's flight (at most 5 a day). */
  airlineAsks: boolean;
}

export interface Settings {
  homes: Homes;
  /** Be at the airport this long before departure (Q-003, default 75). */
  bufferMin: number;
  /** Use phone location: nearest-airport From (Q-051) and leave-by drive estimate (Q-023). */
  useLocation: boolean;
  /**
   * The launch-time location card was answered (Q-051). True after Not Now,
   * and whenever location was turned on any way, so the card never returns.
   */
  locationAsked: boolean;
  /** From of the last Find Routes; fallback origin when location is off (Q-051). */
  lastOrigin: string | null;
  /** Radar overlay on the globe; on by default, remembered (Q-032). */
  radarOn: boolean;
  /** Defaults the Filters panel starts from. */
  search: SearchFilters;
  /** Area toggle per airport code, last choice (Q-048). Missing = off. */
  areaOn: Record<string, boolean>;
  notify: NotifySettings;
}

export const DEFAULT_SETTINGS: Settings = {
  homes: { main: null, extras: [] },
  bufferMin: 75,
  useLocation: false,
  locationAsked: false,
  lastOrigin: null,
  radarOn: true,
  search: DEFAULT_FILTERS,
  areaOn: {},
  notify: { answers: true, airlineAsks: true },
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
  const a = (o.areaOn && typeof o.areaOn === 'object' ? o.areaOn : {}) as Record<string, unknown>;
  const areaOn = Object.fromEntries(
    Object.entries(a).filter((e): e is [string, boolean] => known(e[0]) && typeof e[1] === 'boolean'),
  );
  const useLocation = bool(o.useLocation, DEFAULT_SETTINGS.useLocation);
  const n = (o.notify && typeof o.notify === 'object' ? o.notify : {}) as Record<string, unknown>;
  return {
    homes: { main, extras },
    bufferMin: num(o.bufferMin, DEFAULT_SETTINGS.bufferMin, LIMITS.bufferMin),
    useLocation,
    // Location on (Profile, leave-by or the card) counts as asked; old saves lack the key.
    locationAsked: useLocation || bool(o.locationAsked, false),
    lastOrigin: known(o.lastOrigin) ? o.lastOrigin : null,
    radarOn: bool(o.radarOn, DEFAULT_SETTINGS.radarOn),
    search: {
      maxStops: Math.min(3, Math.max(0, stops)),
      minConnectSameAirlineMin: num(s.minConnectSameAirlineMin, d.minConnectSameAirlineMin, LIMITS.minConnectSameAirlineMin),
      minConnectSwitchMin: num(s.minConnectSwitchMin, d.minConnectSwitchMin, LIMITS.minConnectSwitchMin),
      maxLayoverMin: num(s.maxLayoverMin, d.maxLayoverMin, LIMITS.maxLayoverMin),
    },
    areaOn,
    notify: {
      answers: bool(n.answers, DEFAULT_SETTINGS.notify.answers),
      airlineAsks: bool(n.airlineAsks, DEFAULT_SETTINGS.notify.airlineAsks),
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
  /** Added automatically: same area as the main home (Q-026, Q-048). */
  auto: boolean;
}

/** All home airports, main first, then the rest of its area, then extras. */
export function homeAirports(homes: Homes): HomeAirport[] {
  if (!homes.main) return homes.extras.map((code) => ({ code, main: false, auto: false }));
  const out: HomeAirport[] = [{ code: homes.main, main: true, auto: false }];
  for (const code of areaFor(homes.main)?.airports ?? []) {
    if (code !== homes.main) out.push({ code, main: false, auto: true });
  }
  for (const code of homes.extras) {
    if (!out.some((h) => h.code === code)) out.push({ code, main: false, auto: false });
  }
  return out;
}
