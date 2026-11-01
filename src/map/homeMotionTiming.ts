/**
 * Quiet motion on the home globe (John, 2026-11-01, picked all six): a ripple off the home pin,
 * a preview arc that draws itself between From and To, and a slow idle sway. Pure timing math;
 * the drawing is in HomeMotion.tsx. All of it is off with Reduce Motion.
 */

/** A soft ring grows off the home pin and fades, then a pause, every few seconds. */
export const RIPPLE = { periodMs: 3600, growMs: 1800, spread: 18, startAlpha: 0.4, frameMs: 33 } as const;

/** The ring at `ms` (any clock): how far past the pin it has grown and how strong it is; null between ripples. */
export function rippleAt(ms: number): { grow: number; alpha: number } | null {
  const phase = ((ms % RIPPLE.periodMs) + RIPPLE.periodMs) % RIPPLE.periodMs;
  if (phase >= RIPPLE.growMs) return null;
  const t = phase / RIPPLE.growMs;
  const out = 1 - (1 - t) * (1 - t);
  return { grow: out * RIPPLE.spread, alpha: RIPPLE.startAlpha * (1 - t) };
}

/** The preview arc draws itself from From to To over this long, then stays. */
export const PREVIEW = { drawMs: 900, alpha: 0.6, width: 2, frameMs: 16 } as const;

/** How much of the preview arc shows `ms` after the pair was set (0 to 1, eased). */
export function drawProgress(ms: number): number {
  const t = Math.min(1, Math.max(0, ms / PREVIEW.drawMs));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Idle sway: once the globe has been left alone for a while it turns gently east and west of its
 * resting spot, never far enough to lose it, and stops the moment it's touched.
 */
// Toned down (John, 2026-11-01: "tone down the sway"): 3 degrees each way over a 90-second cycle,
// starting after 8 seconds alone, so it reads as a barely-there drift. Was 9 degrees over 48 seconds.
export const SWAY = { startAfterMs: 8000, rampMs: 8000, periodMs: 90000, amplitudeDeg: 3, frameMs: 66 } as const;

/** Degrees of longitude to turn `ms` after the sway started: eases in, then a slow sine. */
export function swayOffset(ms: number): number {
  if (ms <= 0) return 0;
  const r = Math.min(1, ms / SWAY.rampMs);
  const ramp = r * r * (3 - 2 * r);
  return ramp * SWAY.amplitudeDeg * Math.sin((2 * Math.PI * ms) / SWAY.periodMs);
}
