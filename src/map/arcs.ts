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
 * How the route line flows (round 171). Round 170 bowed every leg into its own arch (13% of its
 * length); John: "The arch is too much. Not every line also has to be an arch. I just want it to
 * look like it flows nicely." Now a nonstop is nearly straight, with only a whisper of a bow
 * toward the pole, and a connecting route flows through each stop like one smooth stroke:
 * each leg leaves and enters a stop along the middle of the turn, so there's no corner.
 */
export const BOW = 0.04;
/** Share of half the turn at a stop that the legs ease into (1 = a full spline; less keeps the legs from humping). */
export const FLOW = 0.6;
/** Most a leg may lean off its straight line at a stop, in radians (about 17 degrees). */
const MAX_LEAN = 0.3;

type V3 = [number, number, number];
const D2R = Math.PI / 180;
const toV = (ll: readonly [number, number]): V3 => {
  const l = ll[0] * D2R;
  const f = ll[1] * D2R;
  return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)];
};
const toLL = (v: V3): LonLat => [Math.atan2(v[1], v[0]) / D2R, Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
/** Unit direction of travel at P heading toward Q along the great circle. */
const heading = (P: V3, Q: V3): V3 => {
  const k = dot(P, Q);
  return norm([Q[0] - k * P[0], Q[1] - k * P[1], Q[2] - k * P[2]]);
};
/** Signed angle from direction u to direction v, turning about axis P. */
const turn = (P: V3, u: V3, v: V3) => Math.atan2(dot(cross(u, v), P), dot(u, v));
const clampLean = (x: number) => Math.max(-MAX_LEAN, Math.min(MAX_LEAN, x));

/**
 * Which way a lone leg leans: toward the nearer pole, the way flight paths look on a flat map, so
 * DAL to LAX and LAX to DAL lean the same way. A leg within 45 degrees of due north or south leans
 * east. +1 = toward the left of travel (A x B), -1 = right, 0 = no leg.
 */
export function bowSign(a: LonLat, b: LonLat): number {
  const A = toV(a);
  const B = toV(b);
  const n = cross(A, B);
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return 0;
  const u = norm(n);
  const mid = norm([A[0] + B[0], A[1] + B[1], A[2] + B[2]]);
  if (Math.abs(cross(u, mid)[2]) > Math.SQRT1_2) {
    const east = norm(cross([0, 0, 1], mid));
    return dot(u, east) >= 0 ? 1 : -1;
  }
  const pole = mid[2] >= 0 ? 1 : -1;
  return u[2] * pole >= 0 ? 1 : -1;
}

/** The legs on either side of this one in its route, so the line can flow through the stops. */
export interface LegNeighbors {
  /** Where the leg before this one took off. */
  prev?: LonLat;
  /** Where the leg after this one lands. */
  next?: LonLat;
}

/**
 * The leg's path at t (0 to 1): its great circle, eased sideways so it meets each stop along the
 * middle of the turn (a Hermite curve with zero offset at both airports), plus the faint bow.
 */
export function flowPoint(a: LonLat, b: LonLat, t: number, nb: LegNeighbors = {}): LonLat {
  const A = toV(a);
  const B = toV(b);
  const n = cross(A, B);
  const p = geoInterpolate([a[0], a[1]], [b[0], b[1]])(t);
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return [p[0], p[1]];
  const u = norm(n);
  const d = geoDistance([a[0], a[1]], [b[0], b[1]]);
  // Lean at each end, in radians off the straight line: half the turn at that stop (Catmull-Rom).
  let lean0 = 0;
  let lean1 = 0;
  if (nb.prev) {
    const P = toV(nb.prev);
    const inDir = heading(A, P).map((x) => -x) as V3;
    lean0 = clampLean((-FLOW * turn(A, inDir, heading(A, B))) / 2);
  }
  if (nb.next) {
    const N = toV(nb.next);
    const inDir = heading(B, A).map((x) => -x) as V3;
    lean1 = clampLean((FLOW * turn(B, inDir, heading(B, N))) / 2);
  }
  const h10 = t * t * t - 2 * t * t + t;
  const h11 = t * t * t - t * t;
  // A lone nonstop gets the faint lean; a connecting leg only eases into its stops, so the two never stack into an arch.
  const bow = nb.prev || nb.next ? 0 : bowSign(a, b) * BOW * d * Math.sin(Math.PI * t);
  const off = d * (lean0 * h10 + lean1 * h11) + bow;
  const P = toV([p[0], p[1]]);
  const c = Math.cos(off);
  const s = Math.sin(off);
  return toLL(norm([P[0] * c + u[0] * s, P[1] * c + u[1] * s, P[2] * c + u[2] * s]));
}

export function arcSamples(a: LonLat, b: LonLat, nb: LegNeighbors = {}): ArcSample[] {
  const d = geoDistance([a[0], a[1]], [b[0], b[1]]);
  const n = Math.max(MIN_SAMPLES, Math.round(d * SAMPLES_PER_RAD));
  const peak = arcLift(d);
  const out: ArcSample[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Ends stay exactly on the airports.
    const ll: LonLat = i === 0 ? [a[0], a[1]] : i === n ? [b[0], b[1]] : flowPoint(a, b, t, nb);
    out.push({ ll, lift: 1 + peak * Math.sin(Math.PI * t) });
  }
  return out;
}

const cache = new WeakMap<RouteLeg, ArcSample[]>();

const neighbors = new WeakMap<RouteLeg, LegNeighbors>();

/**
 * Tells each leg which legs sit before and after it in its route, so its line can flow through
 * the stops (round 171). Call with the routes before drawing or framing them; cheap to repeat.
 */
export function linkRouteLegs(routes: readonly { legs: readonly RouteLeg[] }[]): void {
  for (const r of routes) {
    r.legs.forEach((leg, i) => {
      const nb: LegNeighbors = {
        prev: i > 0 ? r.legs[i - 1].from : undefined,
        next: i < r.legs.length - 1 ? r.legs[i + 1].to : undefined,
      };
      const had = neighbors.get(leg);
      if (had && had.prev === nb.prev && had.next === nb.next) return;
      neighbors.set(leg, nb);
      cache.delete(leg);
    });
  }
}

/** Samples for a leg, computed once per leg object. */
export function legSamples(leg: RouteLeg): ArcSample[] {
  let s = cache.get(leg);
  if (!s) {
    s = arcSamples(leg.from, leg.to, neighbors.get(leg));
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
  // The drawn path, so the curve's belly stays inside the frame too.
  const nb = neighbors.get(leg as RouteLeg) ?? {};
  const out: LonLat[] = [leg.from];
  for (const t of [0.25, 0.5, 0.75]) out.push(flowPoint(leg.from, leg.to, t, nb));
  out.push(leg.to);
  return out;
}
