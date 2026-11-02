/**
 * Quiet motion on the home globe (John, 2026-11-01, picked all six): a ripple off the home pin,
 * and a preview arc that draws itself between From and To (the idle sway was removed 2026-11-02). Pure timing math;
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
