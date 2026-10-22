import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import {
  CLIENT_COOLDOWN_MS,
  fetchFlightStatus,
  flightLookupKey,
  refreshAllowed,
  type FlightLookup,
  type FlightStatusResponse,
} from './flightStatus';

export interface UseFlightStatusResult {
  response: FlightStatusResponse | null;
  loading: boolean;
  error: 'not_configured' | 'fetch_failed' | null;
  /** Re-ask the server; ignored inside the cooldown. Returns whether a request was sent. */
  refresh: () => boolean;
}

export interface UseFlightStatusOptions {
  fetcher?: Fetcher;
  /** Pass null to force "not configured". Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  cooldownMs?: number;
  /** Clock, for tests. */
  nowFn?: () => number;
}

/** Last answer and request time per flight, so reopening a flight inside the cooldown asks nobody. */
const memo = new Map<string, { response: FlightStatusResponse | null; requestedAt: number }>();
export const clearFlightStatusMemo = () => memo.clear();

/**
 * Status for ONE opened flight. Pass null while nothing is open (no request is made).
 * One request on open, then only on a manual refresh outside the cooldown. No polling.
 */
export function useFlightStatus(lookup: FlightLookup | null, opts: UseFlightStatusOptions = {}): UseFlightStatusResult {
  const key = lookup ? flightLookupKey(lookup) : null;
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher, cooldownMs = CLIENT_COOLDOWN_MS } = opts;
  const nowFn = opts.nowFn ?? Date.now;
  const [state, setState] = useState<Omit<UseFlightStatusResult, 'refresh'>>({ response: null, loading: false, error: null });
  const alive = useRef(0);

  const request = useCallback(
    async (k: string, l: FlightLookup, cfg: LiveConfig) => {
      const token = ++alive.current;
      memo.set(k, { response: memo.get(k)?.response ?? null, requestedAt: nowFn() });
      setState((s) => ({ ...s, loading: true }));
      try {
        const response = await fetchFlightStatus(l, cfg, fetcher);
        memo.set(k, { response, requestedAt: memo.get(k)?.requestedAt ?? nowFn() });
        if (token === alive.current) setState({ response, loading: false, error: null });
      } catch {
        if (token === alive.current) setState((s) => ({ ...s, loading: false, error: 'fetch_failed' }));
      }
    },
    [fetcher, nowFn],
  );

  useEffect(() => {
    if (!key || !lookupRef.current) {
      alive.current++;
      setState({ response: null, loading: false, error: null });
      return;
    }
    if (!config) {
      setState({ response: null, loading: false, error: 'not_configured' });
      return;
    }
    const prior = memo.get(key);
    if (prior && !refreshAllowed(prior.requestedAt, nowFn(), cooldownMs)) {
      setState({ response: prior.response, loading: false, error: null });
      return;
    }
    setState({ response: prior?.response ?? null, loading: true, error: null });
    request(key, lookupRef.current, config);
    return () => {
      alive.current++;
    };
  }, [key, config, cooldownMs, nowFn, request]);

  const refresh = useCallback(() => {
    const l = lookupRef.current;
    if (!l || !config || !key) return false;
    if (!refreshAllowed(memo.get(key)?.requestedAt ?? null, nowFn(), cooldownMs)) return false;
    request(key, l, config);
    return true;
  }, [config, key, cooldownMs, nowFn, request]);

  return { ...state, refresh };
}
