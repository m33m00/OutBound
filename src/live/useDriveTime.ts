import { useEffect, useMemo, useRef, useState } from 'react';

import { readLiveConfig, type Fetcher, type LiveConfig } from './airportStatus';
import { fetchDriveTime, type LatLon } from './driveTime';

/** A live drive time, or null while unknown (the card then uses its rough estimate). */
export interface LiveDrive {
  minutes: number;
  /** Who answered, e.g. "Apple Maps". */
  source: string;
}

export interface UseDriveTimeOptions {
  fetcher?: Fetcher;
  /** Pass null to force off. Defaults to EXPO_PUBLIC_* env vars. */
  config?: LiveConfig | null;
}

/** Ask again for the same trip at most this often. */
export const DRIVE_REFRESH_MS = 5 * 60_000;
/** Nudge the departure to a 15-minute slot so small clock moves don't re-ask. */
const SLOT_MS = 15 * 60_000;

const memo = new Map<string, { at: number; drive: LiveDrive | null }>();
export const clearDriveTimeMemo = () => memo.clear();

/**
 * Drive time from `from` to `to`, leaving around `departMs`, with traffic. Null while loading, when
 * live data is off, or when the maps service can't answer, so the caller falls back to its estimate.
 */
export function useDriveTime(
  from: LatLon | null,
  to: LatLon | null,
  departMs: number | null,
  opts: UseDriveTimeOptions = {},
): LiveDrive | null {
  const config = useMemo(() => (opts.config !== undefined ? opts.config : readLiveConfig()), [opts.config]);
  const { fetcher } = opts;
  const key =
    from && to && departMs != null
      ? `${from.lat.toFixed(3)},${from.lon.toFixed(3)}>${to.lat},${to.lon}@${Math.round(departMs / SLOT_MS)}`
      : null;
  const [drive, setDrive] = useState<LiveDrive | null>(() => (key ? (memo.get(key)?.drive ?? null) : null));
  const args = useRef({ from, to, departMs });
  args.current = { from, to, departMs };

  useEffect(() => {
    if (!key || !config) {
      setDrive(null);
      return;
    }
    const prior = memo.get(key);
    setDrive(prior?.drive ?? null);
    if (prior && Date.now() - prior.at < DRIVE_REFRESH_MS) return;
    let alive = true;
    memo.set(key, { at: Date.now(), drive: prior?.drive ?? null });
    const { from: f, to: t, departMs: d } = args.current;
    fetchDriveTime(config, f!, t!, d!, fetcher)
      .then((r) => {
        const next = r.available ? { minutes: r.minutes, source: r.attribution } : null;
        memo.set(key, { at: Date.now(), drive: next });
        if (alive) setDrive(next);
      })
      .catch(() => {
        // Not deployed or offline: keep the estimate; try again after the refresh window.
        if (alive) setDrive(prior?.drive ?? null);
      });
    return () => {
      alive = false;
    };
  }, [key, config, fetcher]);

  return drive;
}
