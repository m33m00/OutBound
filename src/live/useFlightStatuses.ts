import { useEffect, useMemo, useRef, useState } from 'react';
import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import {
  CLIENT_COOLDOWN_MS,
  dedupeLookups,
  fetchFlightStatuses,
  type FlightLookup,
  type FlightStatusEntry,
} from './flightStatus';
import { sampleFlightStatuses } from './fixtures/sampleFlightStatuses';

export interface UseFlightStatusesOptions {
  fetcher?: Fetcher;
  /** Pass null to force sample mode. Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
  /** Test hook for the clock. */
  now?: () => number;
  /** Re-ask interval, never below the client cooldown (default = the cooldown, 2 min). 0 / invalid = fetch once. */
  refreshMs?: number;
}

export interface UseFlightStatusesResult {
  /** Keyed by flightLookupKey(lookup). A flight with no status yet is absent. */
  byKey: Record<string, FlightStatusEntry>;
  /** 'off' = nothing to look up. 'error' = first load failed and nothing is known. */
  state: 'off' | 'loading' | 'ready' | 'error';
  /** True when there is no backend configured and byKey holds fixture data: label it "Sample status". */
  sample: boolean;
}

/** Last answer and request time per flight, shared across mounts, so a re-render or remount inside the cooldown asks nobody. */
const memo = new Map<string, { entry: FlightStatusEntry | null; requestedAt: number }>();
export const clearFlightStatusesMemo = () => memo.clear();

const EMPTY: Record<string, FlightStatusEntry> = {};

/**
 * Live status for a whole results list: one batch request for the flights not asked about in the last cooldown.
 * No backend configured: deterministic sample statuses, `sample: true`.
 */
export function useFlightStatuses(lookups: readonly FlightLookup[], opts: UseFlightStatusesOptions = {}): UseFlightStatusesResult {
  const unique = useMemo(() => dedupeLookups(lookups), [lookups]);
  const idKey = unique.map((u) => u.key).join('\n');
  const uniqueRef = useRef(unique);
  uniqueRef.current = unique;
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher, refreshMs } = opts;
  const now = opts.now ?? Date.now;
  const nowRef = useRef(now);
  nowRef.current = now;

  const [live, setLive] = useState<{ byKey: Record<string, FlightStatusEntry>; state: UseFlightStatusesResult['state'] }>({
    byKey: EMPTY,
    state: 'off',
  });

  // Sample mode is computed synchronously so the first paint already has statuses.
  const sampleByKey = useMemo(
    () => (config ? EMPTY : sampleFlightStatuses(uniqueRef.current.map((u) => u.lookup), nowRef.current())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, idKey],
  );

  useEffect(() => {
    if (!config || unique.length === 0) {
      setLive({ byKey: EMPTY, state: 'off' });
      return;
    }
    const list = uniqueRef.current;
    const every = refreshMs && refreshMs > 0 ? Math.max(refreshMs, CLIENT_COOLDOWN_MS) : refreshMs === undefined ? CLIENT_COOLDOWN_MS : null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const publish = (state: UseFlightStatusesResult['state']) => {
      const byKey: Record<string, FlightStatusEntry> = {};
      for (const { key } of list) {
        const e = memo.get(key)?.entry;
        if (e) byKey[key] = e;
      }
      setLive({ byKey, state: state === 'error' && Object.keys(byKey).length ? 'ready' : state });
    };

    const run = async () => {
      const t = nowRef.current();
      const due = list.filter(({ key }) => {
        const m = memo.get(key);
        return !m || t - m.requestedAt >= CLIENT_COOLDOWN_MS;
      });
      if (due.length === 0) {
        publish('ready');
      } else {
        for (const { key } of due) memo.set(key, { entry: memo.get(key)?.entry ?? null, requestedAt: t });
        publish(list.every(({ key }) => memo.get(key)?.entry) ? 'ready' : 'loading');
        try {
          const got = await fetchFlightStatuses(due.map((d) => d.lookup), config, fetcher);
          for (const { key } of due) {
            const entry = got[key] ?? (memo.get(key)?.entry ? { ...memo.get(key)!.entry!, stale: true } : null);
            memo.set(key, { entry, requestedAt: t });
          }
          if (!cancelled) publish('ready');
        } catch {
          // Keep what we know, flagged stale; only a first-load failure with nothing known is an error.
          for (const { key } of due) {
            const prior = memo.get(key)?.entry;
            if (prior) memo.set(key, { entry: { ...prior, stale: true }, requestedAt: t });
          }
          if (!cancelled) publish('error');
        }
      }
      if (!cancelled && every !== null) timer = setTimeout(run, every);
    };
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [idKey, config, fetcher, refreshMs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) return { byKey: sampleByKey, state: unique.length ? 'ready' : 'off', sample: true };
  return { byKey: live.byKey, state: !unique.length ? 'off' : live.state === 'off' ? 'loading' : live.state, sample: false };
}
