import { Circle, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { runsToSvg, type Runs } from './arcs';
import { drawProgress, PREVIEW, RIPPLE, rippleAt } from './homeMotionTiming';

/** Skia path through screen runs (each run its own contour). */
export function runsPath(runs: Runs): SkPath | null {
  const d = runsToSvg(runs);
  return d ? Skia.Path.MakeFromSVGString(d) : null;
}

/**
 * A soft ring that grows off the home pin and fades every few seconds (John, 2026-11-01). Its own
 * timer, so only the ring redraws; nothing renders between rings. The caller leaves it out with
 * Reduce Motion and while the globe moves.
 */
export function HomeRipple({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const [ring, setRing] = useState<{ grow: number; alpha: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    let last = 0;
    let alive = true;
    const t0 = Date.now();
    const tick = (t: number) => {
      if (!alive) return;
      if (t - last >= RIPPLE.frameMs) {
        last = t;
        const next = rippleAt(Date.now() - t0);
        setRing((was) => (next == null && was == null ? was : next));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);
  if (!ring) return null;
  return <Circle cx={x} cy={y} r={r + ring.grow} color={color} opacity={ring.alpha} style="stroke" strokeWidth={2} />;
}

/**
 * Faint arc between From and To before a search, drawing itself from From each time the pair
 * changes, then staying put (John, 2026-11-01). `animate` false (Reduce Motion) shows it whole.
 */
export function PreviewArc({ runs, pairKey, color, animate }: { runs: Runs; pairKey: string; color: string; animate: boolean }) {
  const path = useMemo(() => runsPath(runs), [runs]);
  const [progress, setProgress] = useState(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) {
      setProgress(1);
      return;
    }
    let frame = 0;
    let alive = true;
    const t0 = Date.now();
    setProgress(0);
    const tick = () => {
      if (!alive) return;
      const p = drawProgress(Date.now() - t0);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [pairKey, animate]);
  if (!path || progress <= 0) return null;
  return (
    <Path
      path={path}
      start={0}
      end={progress}
      style="stroke"
      strokeWidth={PREVIEW.width}
      strokeCap="round"
      strokeJoin="round"
      color={color}
      opacity={PREVIEW.alpha}
    />
  );
}
