/**
 * SAMPLE DATA ONLY. Not real FAA or weather. For __DEV__ previews (Expo Go with no Supabase
 * config) so badges can be seen. Never use it when state is not 'off'.
 */
import type { Itinerary } from '@/engine';
import { buildRouteImpacts, type ImpactReason, type RouteImpactsResult } from '../routeImpacts';

const SAMPLE_MINUTES_OLD = 12;

const LIKELY: ImpactReason[][] = [
  [{ source: 'FAA', text: 'Ground stop', level: 'likelyDelays' }],
  [{ source: 'Weather', text: 'Thunderstorms', level: 'likelyDelays' }],
  [
    { source: 'Weather', text: 'Gusts 42 kt', level: 'likelyDelays' },
    { source: 'FAA', text: 'Delays up to 45 min', level: 'caution' },
  ],
];
const CAUTION: ImpactReason[][] = [
  [{ source: 'Weather', text: 'Low clouds', level: 'caution' }],
  [{ source: 'FAA', text: 'Delays up to 30 min', level: 'caution' }],
  [{ source: 'Weather', text: 'Strong wind 28 kt', level: 'caution' }],
];

const hash = (s: string): number => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Deterministic fake impacts: roughly a quarter of stations Likely delays, a quarter Caution. */
export function sampleRouteImpacts(
  itineraries: readonly Itinerary[],
  nowMs: number = Date.now(),
): Pick<RouteImpactsResult, 'byId' | 'airports'> {
  const asOf = new Date(nowMs - SAMPLE_MINUTES_OLD * 60 * 1000).toISOString();
  const make = (code: string, role: 'connection' | 'destination', forced = false) => {
    const h = hash(code);
    const bucket = forced ? 1 : h % 4;
    const pool = bucket === 0 ? LIKELY : bucket === 1 ? CAUTION : null;
    const reasons = pool ? pool[Math.floor(h / 4) % pool.length] : [];
    return {
      code,
      role,
      level: bucket === 0 ? ('likelyDelays' as const) : bucket === 1 ? ('caution' as const) : ('none' as const),
      reasons,
      asOf,
      stale: false,
      noForecast: false,
    };
  };
  const first = buildRouteImpacts(itineraries, (s) => make(s.code, s.role));
  if (first.airports.length > 0 || itineraries.length === 0) return first;
  // Guarantee at least one badge so the preview is never empty.
  const target = Object.values(first.byId)[0]?.stations[0]?.code;
  return buildRouteImpacts(itineraries, (s) => make(s.code, s.role, s.code === target));
}
