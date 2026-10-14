import { useEffect, useMemo, useState } from 'react';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import {
  fetchAirportWeather,
  normalizeWeatherRequests,
  type StationWeather,
  type WeatherRequest,
} from './airportWeather';

const MAX_TIMER_MS = 2_147_483_647;

export interface UseAirportWeatherResult {
  /** By `weatherKey(request)`. Level 'none' or a missing key = no badge. */
  results: Record<string, StationWeather>;
  /** True when the server could only serve older cached data. */
  stale: boolean;
  loading: boolean;
  error: 'not_configured' | 'fetch_failed' | null;
}

export interface UseAirportWeatherOptions {
  fetcher?: Fetcher;
  /** Pass null to force "not configured". Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  /** Refetch interval; default 5 min (matches the METAR cache). 0 / invalid = no polling. */
  refreshMs?: number;
}

const EMPTY: UseAirportWeatherResult = { results: {}, stale: false, loading: false, error: null };

export function useAirportWeather(
  requests: readonly WeatherRequest[],
  opts: UseAirportWeatherOptions = {},
): UseAirportWeatherResult {
  const list = normalizeWeatherRequests(requests);
  const key = JSON.stringify(list);
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher, refreshMs = 5 * 60 * 1000 } = opts;
  const [state, setState] = useState<UseAirportWeatherResult>(EMPTY);

  useEffect(() => {
    const reqs = JSON.parse(key) as WeatherRequest[];
    if (reqs.length === 0) {
      setState(EMPTY);
      return;
    }
    if (!config) {
      setState({ ...EMPTY, error: 'not_configured' });
      return;
    }
    let cancelled = false;
    const run = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const r = await fetchAirportWeather(reqs, config, fetcher);
        const results: Record<string, StationWeather> = {};
        for (const s of r.results) results[s.key] = s;
        if (!cancelled) setState({ results, stale: r.stale, loading: false, error: null });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: 'fetch_failed' }));
      }
    };
    run();
    const t =
      Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(run, Math.min(refreshMs, MAX_TIMER_MS)) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [key, config, fetcher, refreshMs]);

  return state;
}
