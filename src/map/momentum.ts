/**
 * Flick to spin and settle home (pure; John 2026-10-30: "I want to be able to
 * spin the globe and it spins smoothly and eventually slowly resets back to
 * your location", then: "don't let the globe stop and then reset back. It
 * should naturally after slowing down reset back").
 *
 * - Let go of a drag (with no route open) and the globe keeps the finger's
 *   speed, slows down, and lands on its home view in one motion: a hard flick
 *   spins it round and it comes to rest on home; a gentle one eases back.
 *   Home is your location (the From airport) when nothing is searched, the
 *   routes overview when results are listed (`planSettle`, `settleAt`).
 * - With a route open the globe coasts to a stop where it is and stays
 *   (`momentumStep`).
 * - After a pinch, and under Reduce Motion, the globe goes home after a
 *   few seconds still (`DRIFT_HOME`); Reduce Motion jumps instead of gliding
 *   and never coasts.
 *
 * Timings are provisional (not John-decided).
 */
import { dragDegreesPerPt, LAT_LIMIT, clampLat, normalizeLon, panCamera, type GlobeCamera } from './camera';

export const MOMENTUM = {
  /** Release speed (pt/s) below which a drag just stops where it is. */
  startSpeed: 120,
  /** Coasting ends below this speed (pt/s). */
  stopSpeed: 12,
  /** Fastest coast (pt/s), so a hard flick turns the globe about two times, not ten. */
  maxSpeed: 4000,
  /** Speed falls by e every this many ms (about iOS scroll deceleration, a touch longer). */
  decayMs: 700,
  /** Longest frame step, so a dropped frame doesn't jump the globe. */
  maxStepMs: 48,
} as const;

export const DRIFT_HOME = {
  /** Stillness before the globe heads home (after a pinch; Reduce Motion). */
  delayMs: 4000,
  /** The glide home: slow on purpose, so it reads as settling, not snapping. */
  durationMs: 2200,
} as const;

export interface Velocity {
  x: number;
  y: number;
}

const speedOf = (v: Velocity) => Math.hypot(v.x, v.y);

/** Release velocity capped at maxSpeed (direction kept); null when too slow to coast. */
export function releaseVelocity(vx: number, vy: number, reduceMotion: boolean): Velocity | null {
  if (reduceMotion || !Number.isFinite(vx) || !Number.isFinite(vy)) return null;
  const speed = Math.hypot(vx, vy);
  if (speed < MOMENTUM.startSpeed) return null;
  const k = speed > MOMENTUM.maxSpeed ? MOMENTUM.maxSpeed / speed : 1;
  return { x: vx * k, y: vy * k };
}

export interface MomentumStep {
  camera: GlobeCamera;
  velocity: Velocity;
  done: boolean;
}

/**
 * One frame of coasting: move by velocity × dt the way a drag would, then
 * slow down. Up/down speed is dropped once the globe reaches the latitude
 * limit, so it never sticks against the pole while still "moving".
 */
export function momentumStep(camera: GlobeCamera, velocity: Velocity, dtMs: number): MomentumStep {
  const dt = Math.max(0, Math.min(MOMENTUM.maxStepMs, dtMs));
  const moved = panCamera(camera, (velocity.x * dt) / 1000, (velocity.y * dt) / 1000);
  const decay = Math.exp(-dt / MOMENTUM.decayMs);
  const atPole = Math.abs(moved.center[1]) >= LAT_LIMIT;
  const next = { x: velocity.x * decay, y: atPole ? 0 : velocity.y * decay };
  const out: GlobeCamera = { center: moved.center, radius: camera.radius };
  return { camera: out, velocity: next, done: speedOf(next) < MOMENTUM.stopSpeed };
}

/** Whether the globe should head home now: never while a route is open. */
export function shouldDriftHome(input: { routeOpen: boolean; atHome: boolean }): boolean {
  return !input.routeOpen && !input.atHome;
}

export const SETTLE = {
  /**
   * How far a flick would carry on its own: speed × this. The landing spot is
   * the turn of home nearest to that, so the spin neither stops short nor
   * races on.
   */
  carryMs: 700,
  /** Shortest and longest settle. */
  minMs: 900,
  maxMs: 3200,
  /** A gentle release eases back over about this long, plus slowPer180Ms per half turn. */
  slowBaseMs: 800,
  slowPer180Ms: 1600,
  /** Fastest up/down settle start, degrees per second. */
  maxLatSpeed: 60,
} as const;

/** One continuous move from a release to home: finger speed at the start, still at the end. */
export interface SettlePlan {
  from: GlobeCamera;
  to: GlobeCamera;
  /** Degrees to travel, longitude unwrapped (can be more than a full turn). */
  dLon: number;
  dLat: number;
  /** Release speed in degrees per second. */
  vLon: number;
  vLat: number;
  durationMs: number;
}

/** Finite velocity no faster than MOMENTUM.maxSpeed (direction kept). */
function capped(velocity: Velocity | null): Velocity {
  if (!velocity || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return { x: 0, y: 0 };
  const speed = speedOf(velocity);
  const k = speed > MOMENTUM.maxSpeed ? MOMENTUM.maxSpeed / speed : 1;
  return { x: velocity.x * k, y: velocity.y * k };
}

/** Shortest signed longitude change from a to b, in (-180, 180]. */
function lonDelta(a: number, b: number): number {
  let d = (((b - a) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Time for one axis: matches a forward flick's speed, else eases by distance. */
function axisMs(d: number, v: number): number {
  if (d * v > 0) return (2 * Math.abs(d) * 1000) / Math.abs(v);
  return SETTLE.slowBaseMs + (Math.abs(d) / 180) * SETTLE.slowPer180Ms;
}

/**
 * Plan the settle home from a release. `velocity` is the finger's speed in
 * pt/s (null or zero for no speed). The longitude target is home plus however
 * many full turns lands nearest where the flick would carry by itself, so a
 * hard flick spins round and comes to rest on home, and a short one eases
 * back. Null when the globe is already home.
 */
export function planSettle(from: GlobeCamera, to: GlobeCamera, velocity: Velocity | null): SettlePlan | null {
  const k = dragDegreesPerPt(from.radius);
  const v = capped(velocity);
  // Finger right shows what is west (longitude goes down); finger down shows north.
  const vLon = -v.x * k;
  // Up/down speed is held down so a steep flick can't swing far past home.
  const vLat = Math.max(-SETTLE.maxLatSpeed, Math.min(SETTLE.maxLatSpeed, v.y * k));
  const base = lonDelta(from.center[0], to.center[0]);
  const carry = (vLon * SETTLE.carryMs) / 1000;
  let dLon = base;
  for (let n = -4; n <= 4; n++) {
    const cand = base + 360 * n;
    if (Math.abs(cand - carry) < Math.abs(dLon - carry)) dLon = cand;
  }
  const dLat = to.center[1] - from.center[1];
  const still = Math.abs(dLon) < 0.01 && Math.abs(dLat) < 0.01 && Math.abs(to.radius - from.radius) < 0.5;
  if (still && Math.abs(vLon) < 1 && Math.abs(vLat) < 1) return null;
  const durationMs = Math.max(
    SETTLE.minMs,
    Math.min(SETTLE.maxMs, Math.max(axisMs(dLon, vLon), axisMs(dLat, vLat))),
  );
  return { from, to, dLon, dLat, vLon, vLat, durationMs };
}

/**
 * Hermite curve from 0 to `d` over `durationMs`, starting at speed `v`
 * (units/s) and ending still. Smooth all the way: no stop in the middle.
 */
function hermite(d: number, v: number, s: number, durationMs: number): number {
  const vT = (v * durationMs) / 1000;
  return vT * (s * s * s - 2 * s * s + s) + d * (-2 * s * s * s + 3 * s * s);
}

/** Camera `tMs` into a settle; exactly `plan.to` at the end. */
export function settleAt(plan: SettlePlan, tMs: number): { camera: GlobeCamera; done: boolean } {
  const s = Math.max(0, Math.min(1, tMs / plan.durationMs));
  if (s >= 1) return { camera: plan.to, done: true };
  const { from, to } = plan;
  const smooth = s * s * (3 - 2 * s);
  return {
    camera: {
      center: [
        normalizeLon(from.center[0] + hermite(plan.dLon, plan.vLon, s, plan.durationMs)),
        clampLat(from.center[1] + hermite(plan.dLat, plan.vLat, s, plan.durationMs)),
      ],
      radius: from.radius + (to.radius - from.radius) * smooth,
    },
    done: false,
  };
}
