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

import { cameraOrigin, type GlobeCamera, type Viewport } from './camera';
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

/**
 * Sideways bow, as a share of the leg's length (round 170, John: "make the route lines curve or
 * look more natural free flowing than a straight line"). The lift alone points at the camera when
 * you look straight down on a domestic leg, so it read as a ruler line; the bow swings the path
 * out to one side so it curves from any angle, like a flight map.
 */
export const BOW = 0.13;

type V3 = [number, number, number];
const D2R = Math.PI / 180;
const toV = (ll: readonly [number, number]): V3 => {
  const l = ll[0] * D2R;
  const f = ll[1] * D2R;
  return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)];
};
const toLL = (v: V3): LonLat => [Math.atan2(v[1], v[0]) / D2R, Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

/**
 * The side a leg bows to: toward the nearer pole, the way flight paths look on a flat map, so
 * DAL to LAX and LAX to DAL both arc north and a there-and-back reads as one curve. A leg that
 * runs north-south bows east.
 */
export function bowSide(a: LonLat, b: LonLat): V3 | null {
  const A = toV(a);
  const B = toV(b);
  const n = cross(A, B);
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return null;
  const u = norm(n);
  const mid = norm([A[0] + B[0], A[1] + B[1], A[2] + B[2]]);
  const pole = mid[2] >= 0 ? 1 : -1;
  // Mostly north-south (heading within 45 degrees of north or south): bow east of the midpoint.
  const tangent = cross(u, mid);
  if (Math.abs(tangent[2]) > Math.SQRT1_2) {
    const east = norm(cross([0, 0, 1], mid));
    return u[0] * east[0] + u[1] * east[1] + u[2] * east[2] >= 0 ? u : [-u[0], -u[1], -u[2]];
  }
  return u[2] * pole >= 0 ? u : [-u[0], -u[1], -u[2]];
}

/** The leg's path at t (0 to 1): along the great circle, swung out sideways by the bow. */
export function bowedPoint(a: LonLat, b: LonLat, t: number, side = bowSide(a, b)): LonLat {
  const p = geoInterpolate([a[0], a[1]], [b[0], b[1]])(t);
  if (!side) return [p[0], p[1]];
  const d = geoDistance([a[0], a[1]], [b[0], b[1]]);
  const off = BOW * d * Math.sin(Math.PI * t);
  const P = toV([p[0], p[1]]);
  return toLL(
    norm([
      P[0] * Math.cos(off) + side[0] * Math.sin(off),
      P[1] * Math.cos(off) + side[1] * Math.sin(off),
      P[2] * Math.cos(off) + side[2] * Math.sin(off),
    ]),
  );
}

export function arcSamples(a: LonLat, b: LonLat): ArcSample[] {
  const d = geoDistance([a[0], a[1]], [b[0], b[1]]);
  const n = Math.max(MIN_SAMPLES, Math.round(d * SAMPLES_PER_RAD));
  const peak = arcLift(d);
  const side = bowSide(a, b);
  const out: ArcSample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Ends stay exactly on the airports.
    const ll: LonLat = i === 0 ? [a[0], a[1]] : i === n ? [b[0], b[1]] : bowedPoint(a, b, t, side);
    out.push({ ll, lift: 1 + peak * Math.sin(Math.PI * t) });
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
  const o = cameraOrigin(camera, vp);
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
export function projectSamples(samples: readonly ArcSample[], project: LiftedProjector, surface = false): Runs {
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
  // The bowed path, so the curve's belly stays inside the frame too (round 170).
  const side = bowSide(leg.from, leg.to);
  const out: LonLat[] = [leg.from];
  for (const t of [0.25, 0.5, 0.75]) out.push(bowedPoint(leg.from, leg.to, t, side));
  out.push(leg.to);
  return out;
}
