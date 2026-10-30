/**
 * Flick to spin, then drift home (pure; design round 30, John 2026-10-30:
 * "I want to be able to spin the globe and it spins smoothly and eventually
 * slowly resets back to your location").
 *
 * - A drag let go with speed keeps turning the globe and slows down
 *   smoothly, like a scroll view coasting to a stop.
 * - After the globe has been still for a while with no route open, it glides
 *   slowly back to its home view: your location (the From airport) when
 *   nothing is searched, the routes overview when results are listed.
 * - Reduce Motion: no coasting; the return is a plain jump.
 *
 * Timings are provisional (not John-decided).
 */
import { LAT_LIMIT, panCamera, type GlobeCamera } from './camera';

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
  /** Stillness before the globe heads home. */
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
