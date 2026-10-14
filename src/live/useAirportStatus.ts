import { useEffect, useMemo, useState } from 'react';
import {
  fetchAirportStatus,
  normalizeCodes,
  readLiveConfig,
  type AirportStatus,
  type Fetcher,
  type LiveConfig,
} from './airportStatus';

const MAX_TIMER_MS = 2_147_483_647;

export interface UseAirportStatusResult {
  /** Airports with an FAA event, by code. Absent code = no event (no badge). */
  status: Record<string, AirportStatus>;
  /** FAA's timestamp for the data (show "updated 4m ago"); null until loaded. */
  asOf: string | null;
  /** True when the server could only serve older cached data. */
  stale: boolean;
  loading: boolean;
  error: 'not_configured' | 'fetch_failed' | null;
}

export interface UseAirportStatusOptions {
  fetcher?: Fetcher;
  /** Pass null to force "not configured". Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  /** Refetch interval; default 5 min (matches server cache). */
  refreshMs?: number;
}

export function useAirportStatus(codes: readonly string[], opts: UseAirportStatusOptions = {}): UseAirportStatusResult {
  const key = normalizeCodes(codes).join(',');
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher, refreshMs = 5 * 60 * 1000 } = opts;

  const [state, setState] = useState<UseAirportStatusResult>({
    status: {},
    asOf: null,
    stale: false,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!key) {
      setState({ status: {}, asOf: null, stale: false, loading: false, error: null });
      return;
    }
    if (!config) {
      setState({ status: {}, asOf: null, stale: false, loading: false, error: 'not_configured' });
      return;
    }
    let cancelled = false;
    const run = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const r = await fetchAirportStatus(key.split(','), config, fetcher);
        if (!cancelled) setState({ status: r.airports, asOf: r.asOf, stale: r.stale, loading: false, error: null });
      } catch {
        // Keep the last good data; surface the error.
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: 'fetch_failed' }));
      }
    };
    run();
    // Node/RN clamp delays above 2^31-1 ms to 1 ms; skip invalid values, clamp large ones.
    const t =
      Number.isFinite(refreshMs) && refreshMs > 0 ? setInterval(run, Math.min(refreshMs, MAX_TIMER_MS)) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [key, config, fetcher, refreshMs]);

  return state;
}
