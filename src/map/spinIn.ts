/**
 * Launch spin-in (backlog item 11, Q-036). Pure.
 *
 * Prototype init(): the camera starts rotated a further 150 deg in longitude
 * and 18 deg in latitude from the target (prototype rot + [150, 18], i.e.
 * center - [150, 18]), small (radius 0.36 * min(W, H)) and high (globe center
 * at 0.36 * H), then flies to the normal first camera in 2100 ms, cubic in/out.
 *
 * Plays once per app launch (per JS runtime), on the first GlobeMap mount
 * that has a non-zero layout. Never replays (deselect just flies, Q-018).
 * Skipped under Reduce Motion (the first camera is applied directly). Any
 * touch stops it and the camera snaps to where the spin was heading.
 */
import { clampLat, globeOrigin, normalizeLon, type GlobeCamera, type Viewport } from './camera';

export const SPIN_IN = {
  durationMs: 2100,
  rotateLonDeg: 150,
  rotateLatDeg: 18,
  radiusFactor: 0.36,
  centerYFactor: 0.36,
} as const;

/** Where the spin starts, for a target first camera. */
export function spinStartCamera(target: GlobeCamera, vp: Viewport): GlobeCamera {
  return {
    center: [
      normalizeLon(target.center[0] - SPIN_IN.rotateLonDeg),
      clampLat(target.center[1] - SPIN_IN.rotateLatDeg),
    ],
    radius: SPIN_IN.radiusFactor * Math.min(vp.width, vp.height),
    offsetY: SPIN_IN.centerYFactor * vp.height - globeOrigin(vp).y,
  };
}

let playedThisLaunch = false;

/**
 * Should the first camera spin in? Only for a real layout, with Reduce
 * Motion known to be off, and only once per launch.
 */
export function shouldSpinIn(input: { reduceMotion: boolean; width: number; height: number }): boolean {
  if (playedThisLaunch || input.reduceMotion) return false;
  return input.width > 0 && input.height > 0;
}

/** Mark the spin as used for this launch (also when skipped for Reduce Motion). */
export function markSpinInDone(): void {
  playedThisLaunch = true;
}

/** Tests only. */
export function resetSpinInForTests(): void {
  playedThisLaunch = false;
}
