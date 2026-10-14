/**
 * Great-circle arc geometry (pure, no Skia).
 *
 * Follows arcSamples/liftedPoint in reference/globe-prototype-v9.1.html:
 * each leg is sampled once along its great circle and "lifted" above the
 * surface (more for longer legs), so arcs read as flights, not borders.
 * Samples are computed once per leg (cached); per camera change only the
 * cheap rotate + project step runs.
 *
 * Far side: a lifted point is hidden when it is behind the globe and inside
 * its silhouette. For lift 1 (the surface) that is exactly orthographic
 * clipAngle 90; lifted points just past the horizon still show, as they
 * would on a real sphere.
 */
import { geoDistance, geoInterpolate, geoRotation } from 'd3-geo';

import { globeOrigin, type GlobeCamera, type Viewport } from './camera';
import type { LonLat, RouteLeg } from './types';

export interface ArcSample {
  ll: LonLat;
  /** Height factor: 1 = surface; the sphere radius is multiplied by this. */
  lift: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Screen polyline split where it goes out of sight. Each run has >= 2 points. */
export type Runs = Pt[][];

/** Samples per radian of arc (prototype: 140, minimum 24). */
const SAMPLES_PER_RAD = 140;
const MIN_SAMPLES = 24;

/** Peak lift for a leg of `d` radians (prototype: 0.012 + 0.11 * min(1, d / 1.2)). */
export function arcLift(d: number): number {
  return 0.012 + 0.11 * Math.min(1, d / 1.2);
}

export function arcSamples(a: LonLat, b: LonLat): ArcSample[] {
  const A: [number, number] = [a[0], a[1]];
  const B: [number, number] = [b[0], b[1]];
  const at = geoInterpolate(A, B);
  const d = geoDistance(A, B);
  const n = Math.max(MIN_SAMPLES, Math.round(d * SAMPLES_PER_RAD));
  const peak = arcLift(d);
  const out: ArcSample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = at(t);
    out.push({ ll: [p[0], p[1]], lift: 1 + peak * Math.sin(Math.PI * t) });
  }
  return out;
}

const cache = new WeakMap<RouteLeg, ArcSample[]>();

/** Samples for a leg, computed once per leg object. */
export function legSamples(leg: RouteLeg): ArcSample[] {
  let s = cache.get(leg);
  if (!s) {
    s = arcSamples(leg.from, leg.to);
    cache.set(leg, s);
  }
  return s;
}

const RAD = Math.PI / 180;

/** Projects lifted points for one camera. Build once per camera, reuse for all legs. */
export function makeLiftedProjector(camera: GlobeCamera, vp: Viewport) {
  const rotate = geoRotation([-camera.center[0], -camera.center[1], 0]);
  const o = globeOrigin(vp);
  const R = camera.radius;
  return (ll: LonLat, lift: number): { x: number; y: number; visible: boolean } => {
    const [lon, lat] = rotate([ll[0], ll[1]]);
    const l = lon * RAD;
    const f = lat * RAD;
    const X = Math.cos(f) * Math.sin(l);
    const Y = Math.sin(f);
    const Z = Math.cos(f) * Math.cos(l);
    const visible = Z >= 0 || (X * X + Y * Y) * lift * lift > 1;
    return { x: o.x + R * lift * X, y: o.y - R * lift * Y, visible };
  };
}

export type LiftedProjector = ReturnType<typeof makeLiftedProjector>;

/**
 * Screen runs for samples. `surface` drops the lift (ground shadow).
 * Hidden points split the line; single-point runs are dropped.
 */
export function projectSamples(
  samples: readonly ArcSample[],
  project: LiftedProjector,
  surface = false,
): Runs {
  const runs: Runs = [];
  let run: Pt[] = [];
  for (const s of samples) {
    const p = project(s.ll, surface ? 1 : s.lift);
    if (!p.visible) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    run.push({ x: p.x, y: p.y });
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** SVG path data for runs (one native call per path in Skia). */
export function runsToSvg(runs: Runs): string | null {
  let d = '';
  for (const run of runs) {
    d += `M${run[0].x.toFixed(1)} ${run[0].y.toFixed(1)}`;
    for (let i = 1; i < run.length; i++) d += `L${run[i].x.toFixed(1)} ${run[i].y.toFixed(1)}`;
  }
  return d.length > 0 ? d : null;
}

/**
 * Points that frame a route box: leg ends plus great-circle points between,
 * so long legs that bow north still fit.
 */
export function legFramePoints(leg: Pick<RouteLeg, 'from' | 'to'>): LonLat[] {
  const at = geoInterpolate([leg.from[0], leg.from[1]], [leg.to[0], leg.to[1]]);
  const out: LonLat[] = [leg.from];
  for (const t of [0.25, 0.5, 0.75]) {
    const p = at(t);
    out.push([p[0], p[1]]);
  }
  out.push(leg.to);
  return out;
}
