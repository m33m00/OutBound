/**
 * Camera fly-to math (pure). Values follow flyTo in the v9.1 prototype
 * (cubic ease-in-out, shortest way round, a small zoom-out mid-flight),
 * with the duration trimmed from the prototype's 950 ms to 900 ms to sit in
 * the 600-900 ms range given for item 4 (provisional).
 *
 * Reduce Motion (DECISIONS.md / agent rules): no fly-to, jump instantly.
 */
import { normalizeLon, type GlobeCamera } from './camera';

export const FLY_MS = 900;
/** Fraction the globe shrinks at mid-flight, for a sense of travel. */
export const FLY_ZOOM_BUMP = 0.12;
/** A re-frame for a panel size change: about as long as the panel's own spring. */
export const REFRAME_MS = 350;

export function easeCubicInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Camera at eased progress `e` (0..1) between two cameras. */
export function interpolateCamera(from: GlobeCamera, to: GlobeCamera, e: number): GlobeCamera {
  if (e >= 1) return to;
  let dLon = to.center[0] - from.center[0];
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const bump = Math.sin(Math.PI * e) * FLY_ZOOM_BUMP;
  const cam: GlobeCamera = {
    center: [
      normalizeLon(from.center[0] + dLon * e),
      from.center[1] + (to.center[1] - from.center[1]) * e,
    ],
    radius: (from.radius + (to.radius - from.radius) * e) * (1 - bump),
  };
  const y0 = from.offsetY ?? 0;
  const y1 = to.offsetY ?? 0;
  if (y0 !== 0 || y1 !== 0) cam.offsetY = y0 + (y1 - y0) * e;
  return cam;
}

export type CameraMove = { animate: false } | { animate: true; durationMs: number };

/** Below this change the camera just jumps (nothing worth animating). */
const SAME_DEG = 0.01;
const SAME_RADIUS = 0.5;

export function sameCamera(a: GlobeCamera, b: GlobeCamera): boolean {
  let dLon = Math.abs(a.center[0] - b.center[0]);
  if (dLon > 180) dLon = 360 - dLon;
  return (
    dLon < SAME_DEG &&
    Math.abs(a.center[1] - b.center[1]) < SAME_DEG &&
    Math.abs(a.radius - b.radius) < SAME_RADIUS &&
    Math.abs((a.offsetY ?? 0) - (b.offsetY ?? 0)) < SAME_RADIUS
  );
}

/**
 * How to get from `from` to `to`: jump when Reduce Motion is on, when there
 * is no camera yet (first layout) or when nothing changes; fly otherwise.
 */
export function planCameraMove(
  from: GlobeCamera | null,
  to: GlobeCamera,
  reduceMotion: boolean,
): CameraMove {
  if (reduceMotion || !from || sameCamera(from, to)) return { animate: false };
  return { animate: true, durationMs: FLY_MS };
}

/** A flight in progress: where it ends, when (ms clock) and if it is the launch spin-in. */
export interface RunningFlight {
  to: GlobeCamera;
  endsAt: number;
  spin: boolean;
}

export type RetargetPlan =
  | { kind: 'jump' }
  | { kind: 'fly'; durationMs: number; spin: false }
  | { kind: 'continue'; durationMs: number; spin: boolean };

/**
 * What a camera target effect does when a camera already exists:
 * - a NEW target (route selected, deselected, fit): cancel any running
 *   flight, the spin-in included, and fly from where the camera is now
 *   (FLY_MS; the spin's raised offset flies back to 0), or jump under
 *   Reduce Motion;
 * - the same target re-framed (layout or panel change) mid-flight: keep
 *   flying to the re-framed camera for the time left (a spin stays a spin);
 * - the same target re-framed at rest (the panel changed size): glide over
 *   REFRAME_MS so the globe moves with the panel instead of snapping
 *   (design round 29);
 * - a new resting spot (`homeOnly`) during the spin-in: the spin carries on
 *   to it for the time left (design round 30);
 * - otherwise (Reduce Motion, or nothing moved) jump.
 */
export function planRetarget(input: {
  isNewTarget: boolean;
  /**
   * The new target only moves the resting spot (your location arrived):
   * a running spin-in keeps spinning to it instead of being cut short.
   */
  homeOnly?: boolean;
  from: GlobeCamera;
  to: GlobeCamera;
  running: RunningFlight | null;
  reduceMotion: boolean;
  nowMs: number;
}): RetargetPlan {
  const { isNewTarget, homeOnly, from, to, running, reduceMotion, nowMs } = input;
  if (isNewTarget && homeOnly && running?.spin && !reduceMotion) {
    const left = running.endsAt - nowMs;
    if (left > 50) return { kind: 'continue', durationMs: left, spin: true };
  }
  if (isNewTarget) {
    const plan = planCameraMove(from, to, reduceMotion);
    return plan.animate ? { kind: 'fly', durationMs: plan.durationMs, spin: false } : { kind: 'jump' };
  }
  if (running && !reduceMotion) {
    const left = running.endsAt - nowMs;
    if (left > 50) return { kind: 'continue', durationMs: left, spin: running.spin };
  }
  if (!reduceMotion && !sameCamera(from, to)) return { kind: 'fly', durationMs: REFRAME_MS, spin: false };
  return { kind: 'jump' };
}
