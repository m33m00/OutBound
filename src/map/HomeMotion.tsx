import { Circle, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { runsToSvg, type Pt, type Runs } from './arcs';
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

/** Draws 0 to 1 over PREVIEW.drawMs each time `key` changes; whole at once without motion. */
function useDrawIn(key: string, animate: boolean): number {
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
  }, [key, animate]);
  return progress;
}

/**
 * The preview between From and To before a search (John, 2026-11-01): each line draws itself from its From
 * end, all together, then stays put. Since round 224 there can be several (a country, state or city), each a
 * thin blue line with a small dot at both airports, like the hub map John sent. `animate` false (Reduce
 * Motion) shows them whole.
 */
export function PreviewArcs({
  lines,
  dots = [],
  pairKey,
  color,
  ring,
  animate,
}: {
  lines: readonly Runs[];
  dots?: readonly Pt[];
  pairKey: string;
  color: string;
  /** The thin ring around each dot, so it reads on land and sea alike. */
  ring?: string;
  animate: boolean;
}) {
  const paths = useMemo(() => lines.map(runsPath), [lines]);
  const progress = useDrawIn(pairKey, animate);
  if (progress <= 0) return null;
  return (
    <>
      {paths.map((path, i) =>
        path ? (
          <Path
            key={i}
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
        ) : null,
      )}
      {dots.map((d, i) => (
        <Group key={`dot${i}`} opacity={progress}>
          {ring ? <Circle cx={d.x} cy={d.y} r={PREVIEW.dot + PREVIEW.ring} color={ring} /> : null}
          <Circle cx={d.x} cy={d.y} r={PREVIEW.dot} color={color} />
        </Group>
      ))}
    </>
  );
}

/** One preview line, as before round 224. */
export function PreviewArc({ runs, pairKey, color, animate }: { runs: Runs; pairKey: string; color: string; animate: boolean }) {
  return <PreviewArcs lines={[runs]} pairKey={pairKey} color={color} animate={animate} />;
}
