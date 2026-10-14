import { useEffect, useMemo, useState } from 'react';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import {
  clampRefreshMs,
  fetchRadar,
  framesFromResponse,
  nextRefreshDelay,
  normalizeRadarRegions,
  type RadarFrame,
} from './radar';
import { RADAR_CONFIG } from '../../supabase/functions/_shared/radarConfig';

export interface UseRadarResult {
  /** One per region with a picture. Draw only `available` ones; show age from `observedAt`. */
  frames: RadarFrame[];
  attribution: string;
  /** 'off' = env missing or no regions asked for. */
  state: 'off' | 'loading' | 'ready' | 'error';
}

export interface UseRadarOptions {
  fetcher?: Fetcher;
  /** Pass null to force "off". Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  /** Poll interval, clamped to 30 s - 10 min; default 2 min. 0 / invalid = fetch once, no polling. */
  refreshMs?: number;
  /** Test hook for the clock. */
  now?: () => number;
}

const OFF: UseRadarResult = { frames: [], attribution: RADAR_CONFIG.attribution, state: 'off' };

export function useRadar(regions: readonly string[], opts: UseRadarOptions = {}): UseRadarResult {
  const key = normalizeRadarRegions(regions).join(',');
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher, refreshMs, now = Date.now } = opts;
  const [result, setResult] = useState<UseRadarResult>(OFF);

  useEffect(() => {
    if (!key || !config) {
      setResult(OFF);
      return;
    }
    const list = key.split(',');
    const base = clampRefreshMs(refreshMs);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    setResult((r) => ({ ...r, state: r.frames.length ? 'ready' : 'loading' }));

    const run = async () => {
      try {
        const res = await fetchRadar(list, config, fetcher);
        failures = 0;
        if (!cancelled) {
          setResult({ frames: framesFromResponse(res, config, now()), attribution: res.attribution, state: 'ready' });
        }
      } catch {
        failures += 1;
        if (!cancelled) {
          // Keep what we have, flagged stale; only a first-load failure is an error.
          setResult((r) =>
            r.frames.length
              ? { ...r, frames: r.frames.map((f) => ({ ...f, stale: true })), state: 'ready' }
              : { ...r, state: 'error' },
          );
        }
      }
      if (!cancelled && base !== null) timer = setTimeout(run, nextRefreshDelay(base, failures));
    };
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key, config, fetcher, refreshMs, now]);

  return result;
}
