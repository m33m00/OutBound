/**
 * Item 7 glue: turns FAA status + weather into per-route badges (G2 stations, worst wins).
 * `routeImpacts` is pure; `useRouteImpacts` batches ONE FAA call and ONE weather call per search.
 */
import { useMemo } from 'react';
import type { Itinerary } from '@/engine';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import { weatherKey, normalizeWeatherRequests, type StationWeather } from './airportWeather';
import { combineImpact, weatherRequestsForItinerary, type ImpactReason } from './impact';
import { useAirportStatus, type UseAirportStatusResult } from './useAirportStatus';
import { useAirportWeather, type UseAirportWeatherResult } from './useAirportWeather';

export type { ImpactReason };
export type ImpactLevel = 'none' | 'caution' | 'likelyDelays';

export interface StationImpact {
  /** IATA. */
  code: string;
  role: 'connection' | 'destination';
  level: ImpactLevel;
  /** Worst first. */
  reasons: ImpactReason[];
  /** ISO, oldest input used. */
  asOf: string | null;
  stale: boolean;
  /** Weather beyond the TAF window (Q-028): no weather badge, show "no forecast yet" if wanted. */
  noForecast: boolean;
}

export interface RouteImpact {
  level: ImpactLevel;
  stations: StationImpact[];
  asOf: string | null;
  stale: boolean;
}

export interface RouteImpactsResult {
  /** off = not configured (no env vars). */
  state: 'off' | 'loading' | 'ready' | 'error';
  /** Keyed by Itinerary.id. */
  byId: Record<string, RouteImpact>;
  /** Deduped stations with a badge, for the globe. */
  airports: { code: string; level: Exclude<ImpactLevel, 'none'> }[];
}

const RANK: Record<ImpactLevel, number> = { none: 0, caution: 1, likelyDelays: 2 };

const oldest = (stamps: (string | null)[]): string | null => {
  const s = stamps.filter((x): x is string => !!x);
  return s.length ? s.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a)) : null;
};

/** The stations to evaluate for one itinerary, in order (connections, then destination). */
export function stationsForItinerary(itin: Pick<Itinerary, 'legs'>) {
  const reqs = weatherRequestsForItinerary(itin);
  return reqs.map((r, i) => {
    const request = normalizeWeatherRequests([r])[0];
    return {
      code: request.station,
      role: (i === reqs.length - 1 ? 'destination' : 'connection') as StationImpact['role'],
      key: weatherKey(request),
    };
  });
}

/** Assembles byId + airports from a per-station function. Shared with the sample fixture. */
export function buildRouteImpacts(
  itineraries: readonly Itinerary[],
  stationImpact: (s: { code: string; role: StationImpact['role']; key: string }) => StationImpact,
): Pick<RouteImpactsResult, 'byId' | 'airports'> {
  const byId: Record<string, RouteImpact> = {};
  const worst = new Map<string, Exclude<ImpactLevel, 'none'>>();
  for (const itin of itineraries) {
    const stations = stationsForItinerary(itin).map(stationImpact);
    let level: ImpactLevel = 'none';
    for (const s of stations) {
      if (RANK[s.level] > RANK[level]) level = s.level;
      if (s.level !== 'none' && RANK[s.level] > RANK[worst.get(s.code) ?? 'none']) worst.set(s.code, s.level);
    }
    byId[itin.id] = { level, stations, asOf: oldest(stations.map((s) => s.asOf)), stale: stations.some((s) => s.stale) };
  }
  const airports = [...worst].map(([code, level]) => ({ code, level })).sort((a, b) => (a.code < b.code ? -1 : 1));
  return { byId, airports };
}

type FaaData = Pick<UseAirportStatusResult, 'status' | 'asOf' | 'stale'>;
type WeatherData = Pick<UseAirportWeatherResult, 'results' | 'stale'>;

export function routeImpacts(
  itineraries: readonly Itinerary[],
  faa: FaaData,
  weather: WeatherData,
): Pick<RouteImpactsResult, 'byId' | 'airports'> {
  return buildRouteImpacts(itineraries, ({ code, role, key }) => {
    const w: StationWeather | undefined = weather.results[key];
    const c = combineImpact({ status: faa.status[code], asOf: faa.asOf }, w);
    const noForecast = w?.state === 'noForecast';
    const stale = (faa.asOf !== null && faa.stale) || (w?.state === 'ok' && (w.stale || weather.stale));
    return { code, role, level: c.level, reasons: c.reasons, asOf: c.asOf, stale, noForecast };
  });
}

export interface UseRouteImpactsOptions {
  faaFetcher?: Fetcher;
  weatherFetcher?: Fetcher;
  /** Pass null to force "not configured". Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  refreshMs?: number;
}

export function useRouteImpacts(itineraries: readonly Itinerary[], opts: UseRouteImpactsOptions = {}): RouteImpactsResult {
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { requests, codes } = useMemo(() => {
    const requests = itineraries.flatMap((i) => weatherRequestsForItinerary(i));
    return { requests, codes: requests.map((r) => r.station) };
  }, [itineraries]);

  const shared = { config, refreshMs: opts.refreshMs };
  const faa = useAirportStatus(codes, { ...shared, fetcher: opts.faaFetcher });
  const wx = useAirportWeather(requests, { ...shared, fetcher: opts.weatherFetcher });

  return useMemo<RouteImpactsResult>(() => {
    const faaOff = faa.error === 'not_configured';
    const wxOff = wx.error === 'not_configured';
    if (!config || (faaOff && wxOff)) return { state: 'off', byId: {}, airports: [] };
    const { byId, airports } = routeImpacts(
      itineraries,
      faaOff ? { status: {}, asOf: null, stale: false } : faa,
      wxOff ? { results: {}, stale: false } : wx,
    );
    const hasData = (!faaOff && faa.asOf !== null) || (!wxOff && Object.keys(wx.results).length > 0);
    const failed = (faaOff || faa.error === 'fetch_failed') && (wxOff || wx.error === 'fetch_failed');
    const state: RouteImpactsResult['state'] =
      itineraries.length === 0 || hasData ? 'ready' : failed ? 'error' : 'loading';
    return { state, byId, airports };
  }, [config, itineraries, faa, wx]);
}
