/**
 * Runs the flight preview for GlobeMap (backlog item 11). The timeline and
 * the run state machine are pure (preview.ts); this hook only owns the
 * animation frame loop and React state.
 *
 * - A new `preview` request (routeId + nonce) starts a run, or reports
 *   'cancelled' right away (Reduce Motion, route not selected, nothing to fly).
 * - The run cancels on: cancel() (any touch), a selection change, the route
 *   disappearing, Reduce Motion turning on, a new request, null, unmount.
 * - `skyUtc` follows the simulated time at about 9 Hz (null = real time).
 *
 * Per-frame data (the plane) goes to `onFrame`, NOT React state: the hook
 * re-renders only when a run starts or ends and when skyUtc changes (~9 Hz),
 * so GlobeMap is not re-rendered at 60 Hz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { decidePreview, PreviewRun, previewLostRoute, type PreviewSample } from './preview';
import { nextSkyTime } from './sun';
import type { MapPreviewRequest, MapPreviewState, RouteLine } from './types';

export interface FlightPreviewInput {
  preview: MapPreviewRequest | null | undefined;
  routes: readonly RouteLine[];
  selectedId: string | null;
  reduceMotion: boolean;
  onPreviewState?: (s: MapPreviewState) => void;
  /** Called when a run starts (GlobeMap fits the route). */
  onStart?: (routeId: string) => void;
  /** Called every animation frame while playing, and with null when it stops. */
  onFrame?: (sample: PreviewSample | null) => void;
}

export interface FlightPreview {
  /** True while a run is playing (radar hidden, plane shown). */
  active: boolean;
  /** Sky time to draw (throttled sim time), or null for real time. */
  skyUtc: number | null;
  /** Cancel a playing run. Returns true if one was playing. */
  cancel: () => boolean;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function useFlightPreview(input: FlightPreviewInput): FlightPreview {
  const { preview, routes, selectedId, reduceMotion } = input;
  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  const runRef = useRef<PreviewRun | null>(null);
  const rafRef = useRef<number | null>(null);
  const skyRef = useRef({ utc: NaN, at: -Infinity });
  const [active, setActive] = useState(false);
  const frameOut = useCallback((s: PreviewSample | null) => latest.current.onFrame?.(s), []);
  const [skyUtc, setSkyUtc] = useState<number | null>(null);

  const report = useCallback((s: MapPreviewState) => latest.current.onPreviewState?.(s), []);

  const stop = useCallback((): boolean => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const run = runRef.current;
    runRef.current = null;
    setActive(false);
    setSkyUtc(null);
    skyRef.current = { utc: NaN, at: -Infinity };
    if (run) frameOut(null);
    if (!run || run.endedAs) return false;
    run.cancel();
    return true;
  }, []);

  const key = preview ? `${preview.routeId}\u0000${preview.nonce}` : null;
  useEffect(() => {
    if (!key) return;
    const cur = latest.current;
    const decision = decidePreview({
      preview: cur.preview,
      reduceMotion: cur.reduceMotion,
      selectedId: cur.selectedId,
      routes: cur.routes,
    });
    if (decision.action === 'reject') {
      report(decision.state);
      return;
    }
    if (decision.action !== 'start') return;

    cur.onStart?.(decision.timeline.routeId);
    const run = new PreviewRun(decision.timeline, now(), report);
    runRef.current = run;
    setActive(true);
    const frame = () => {
      if (runRef.current !== run) return;
      const t = now();
      const s = run.tick(t);
      if (!s) {
        // Finished ('done' reported by the run).
        runRef.current = null;
        rafRef.current = null;
        setActive(false);
        setSkyUtc(null);
        frameOut(null);
        skyRef.current = { utc: NaN, at: -Infinity };
        return;
      }
      frameOut(s);
      if (s.simUtc != null) {
        const next = nextSkyTime(skyRef.current, { nowMs: Date.now(), wallMs: t, simUtc: s.simUtc });
        if (next !== skyRef.current) {
          skyRef.current = next;
          setSkyUtc(next.utc);
        }
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    frame();
    return () => {
      stop();
    };
  }, [key, report, stop, frameOut]);

  // Selection moved away, route gone, or Reduce Motion turned on: cancel.
  useEffect(() => {
    const run = runRef.current;
    if (!run) return;
    if (reduceMotion || previewLostRoute(run.routeId, selectedId, routes)) stop();
  }, [selectedId, routes, reduceMotion, stop]);

  return { active, skyUtc, cancel: stop };
}
