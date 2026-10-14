/**
 * Tap hit testing on projected route lines (pure).
 *
 * A tap hits a route if it is closer than MAP_LINE_HIT_AREA pt to any visible
 * segment (v9.1 prototype handleGlobeTap). The selected route wins whenever
 * it is in range; otherwise the nearest route wins, ties going to the
 * earlier route in the list (earliest arriving).
 */
import type { Pt, Runs } from './arcs';
import { MAP_LINE_HIT_AREA } from './types';

export interface HitLine {
  routeId: string;
  runs: Runs;
}

/** Distance from p to segment ab. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Smallest distance from p to any run; Infinity if there are no segments. */
export function polylineDistance(p: Pt, runs: Runs): number {
  let best = Infinity;
  for (const run of runs) {
    for (let i = 1; i < run.length; i++) {
      const d = segmentDistance(p, run[i - 1], run[i]);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Route id under the tap, or null. `lines` in list order. */
export function hitTestRoutes(
  p: Pt,
  lines: readonly HitLine[],
  selectedId: string | null,
  maxDistance: number = MAP_LINE_HIT_AREA,
): string | null {
  let bestId: string | null = null;
  let bestD = maxDistance;
  let selectedD = Infinity;
  // Each route may be listed in several parts (one per leg): take its minimum.
  for (const line of lines) {
    const d = polylineDistance(p, line.runs);
    if (line.routeId === selectedId && d < selectedD) selectedD = d;
    if (d < bestD) {
      bestD = d;
      bestId = line.routeId;
    }
  }
  if (selectedId != null && selectedD < maxDistance) return selectedId;
  return bestId;
}
