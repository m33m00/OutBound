/**
 * Route pulse (John, 2026-11-01: "make the route lines pulse slowly animated in the direction"):
 * a soft bright stretch that slides along each arc from origin to destination. On a connection it
 * runs leg by leg, so it reads as one trip, then rests a moment before starting again.
 * Off with Reduce Motion and while the globe is being dragged or flying.
 *
 * Pure and worklet-safe: the Skia canvas calls `pulseWindow` on the UI thread every frame.
 */

export const PULSE = {
  /** Time to cross one leg. Slow on purpose. */
  legMs: 2600,
  /** Rest after the last leg before the next pulse leaves. */
  restMs: 1200,
  /** Length of the bright stretch, as a share of the leg. */
  length: 0.24,
  /** Strength on the picked route, and on the other routes while one is picked or none is. */
  selectedAlpha: 0.75,
  otherAlpha: 0.4,
  /** Soft edge on the bright stretch, px. */
  blur: 2,
} as const;

export interface PulseWindow {
  /** Trim of the leg's path, 0..1 from origin. start === end means nothing drawn. */
  start: number;
  end: number;
}

const ease = (t: number) => {
  'worklet';
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

/** Where the bright stretch is on leg `legIndex` of `legCount` at clock time `ms`. */
export function pulseWindow(ms: number, legIndex: number, legCount: number, cfg = PULSE): PulseWindow {
  'worklet';
  const cycle = legCount * cfg.legMs + cfg.restMs;
  const local = ((ms % cycle) + cycle) % cycle;
  const p = local / cfg.legMs - legIndex;
  if (p <= 0 || p >= 1) return { start: 0, end: 0 };
  // The head runs from the origin to past the destination, so the tail leaves the leg cleanly.
  const head = ease(p) * (1 + cfg.length);
  const start = Math.min(1, Math.max(0, head - cfg.length));
  const end = Math.min(1, Math.max(0, head));
  return end > start ? { start, end } : { start: 0, end: 0 };
}
