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
  return {
    center: [
      normalizeLon(from.center[0] + dLon * e),
      from.center[1] + (to.center[1] - from.center[1]) * e,
    ],
    radius: (from.radius + (to.radius - from.radius) * e) * (1 - bump),
  };
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
    Math.abs(a.radius - b.radius) < SAME_RADIUS
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
