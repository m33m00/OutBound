/**
 * Airport status badges (backlog item 7), pure: no Skia, no React.
 *
 * DECISIONS.md "Weather": Caution = violet `caution` token, Likely delays =
 * magenta `likelyDelays` token. No legend or weather key on the map. Amber
 * stays "you" only and tier colors are never used here.
 *
 * Level never relies on color alone, the shape differs too:
 * - Caution: filled diamond (half-diagonal 5 pt).
 * - Likely delays: filled up-pointing triangle (circumradius 6 pt), the
 *   "warning" shape, a bit larger since it is the stronger level.
 * Both sit on an opaque `surface` halo so they read on land and ocean in
 * either scheme (graphic contrast >= 3:1 against the halo, see tests).
 *
 * Placement: like a notification dot at the upper-left of the airport's
 * item 9 mark (home pin, origin dot, destination ring, connection ring),
 * pushed out far enough that it never covers that mark. A home group pin
 * ("JFK/LGA") carries the worst status of its codes. An airport with no
 * item 9 mark gets the badge centered on the airport itself. Badges are
 * label obstacles (see marksLayer) and are never tappable.
 *
 * While a route is selected, badges on that route's airports stay at full
 * strength and the rest dim to STATUS_BADGE.dimAlpha.
 */
import type { Palette } from '@/theme';

import type { LiftedProjector } from './arcs';
import { markExtent, type MarkKind, type MarkSpec } from './marks';
import type { AirportStatusLevel, AirportStatusMark, LonLat, RouteLine } from './types';

export type StatusShape = 'diamond' | 'triangle';

/** Sizes in pt. */
export const STATUS_BADGE = {
  caution: { shape: 'diamond' as StatusShape, r: 5 },
  likelyDelays: { shape: 'triangle' as StatusShape, r: 6 },
  /** Surface halo stroke width under the fill; half (1.5 pt) shows outside the shape. */
  halo: 3,
  /** Alpha of badges not on the selected route. */
  dimAlpha: 0.35,
} as const;

const RANK: Record<AirportStatusLevel, number> = { caution: 1, likelyDelays: 2 };

/** Outer radius of a badge including its halo. */
export function statusExtent(level: AirportStatusLevel): number {
  return STATUS_BADGE[level].r + STATUS_BADGE.halo / 2;
}

/** Largest badge extent; used for the offset so both levels sit in the same spot. */
export const STATUS_MAX_EXTENT = Math.max(statusExtent('caution'), statusExtent('likelyDelays'));

/**
 * Badge center relative to the airport mark center: up-left on the
 * diagonal, so the badge's circumscribed circle just clears the mark's
 * outer edge. No mark (anchor null) = centered on the airport.
 */
export function statusOffset(anchor: MarkKind | null): { dx: number; dy: number } {
  if (anchor == null) return { dx: 0, dy: 0 };
  const d = (markExtent(anchor) + STATUS_MAX_EXTENT) / Math.SQRT2;
  return { dx: -d, dy: -d };
}

interface Pt {
  x: number;
  y: number;
}

/** Badge outline (closed polygon) centered at x, y. */
export function statusShapePoints(level: AirportStatusLevel, x: number, y: number): Pt[] {
  const { shape, r } = STATUS_BADGE[level];
  if (shape === 'diamond') {
    return [
      { x, y: y - r },
      { x: x + r, y },
      { x, y: y + r },
      { x: x - r, y },
    ];
  }
  // Equilateral triangle, centroid at (x, y), apex up.
  const h = (r * Math.sqrt(3)) / 2;
  return [
    { x, y: y - r },
    { x: x + h, y: y + r / 2 },
    { x: x - h, y: y + r / 2 },
  ];
}

export interface StatusSpec {
  /** Airport codes this badge stands for (several when a home group shares a pin). */
  codes: string[];
  level: AirportStatusLevel;
  /** Where the anchor (the mark, or the airport) is. */
  coord: LonLat;
  /** The item 9 mark the badge rides on, or null if the airport has none. */
  anchor: MarkKind | null;
  /** True while another route is selected (draw at dimAlpha). */
  dim: boolean;
}

/** One level per code, worst wins; first-seen order kept. */
function worstPerCode(statuses: readonly AirportStatusMark[]): AirportStatusMark[] {
  const byCode = new Map<string, AirportStatusMark>();
  for (const s of statuses) {
    const prev = byCode.get(s.code);
    if (!prev || RANK[s.level] > RANK[prev.level]) byCode.set(s.code, prev ? { ...prev, level: s.level } : s);
  }
  return [...byCode.values()];
}

/** Codes of the selected route's airports. */
function routeCodes(route: RouteLine | null | undefined): Set<string> | null {
  if (!route) return null;
  const set = new Set<string>();
  for (const l of route.legs) {
    set.add(l.fromCode);
    set.add(l.toCode);
  }
  return set;
}

/**
 * Badges to draw, back to front: dimmed first, then Caution, then Likely
 * delays on top. `marks` is the output of `markSet` for the same frame.
 */
export function statusSet(
  statuses: readonly AirportStatusMark[] | undefined,
  marks: readonly MarkSpec[],
  selectedRoute?: RouteLine | null,
): StatusSpec[] {
  if (!statuses || statuses.length === 0) return [];
  // Code -> mark it belongs to. Home pins stand for every code in their group.
  const markOf = new Map<string, MarkSpec>();
  for (const m of marks) {
    const codes = m.kind === 'home' || m.kind === 'altHome' ? m.label.split('/') : [m.code];
    for (const c of codes) if (!markOf.has(c)) markOf.set(c, m);
  }
  const onRoute = routeCodes(selectedRoute);

  // Merge statuses that share a mark (home group) into one badge.
  const byKey = new Map<string, StatusSpec>();
  for (const s of worstPerCode(statuses)) {
    const m = markOf.get(s.code);
    const key = m ? `mark:${m.code}` : `ap:${s.code}`;
    const prev = byKey.get(key);
    if (prev) {
      prev.codes.push(s.code);
      if (RANK[s.level] > RANK[prev.level]) prev.level = s.level;
      continue;
    }
    byKey.set(key, { codes: [s.code], level: s.level, coord: m ? m.coord : s.coord, anchor: m ? m.kind : null, dim: false });
  }
  const out = [...byKey.values()];
  for (const b of out) b.dim = onRoute != null && !b.codes.some((c) => onRoute.has(c));
  return out
    .map((b, i) => ({ b, i }))
    .sort((p, q) => Number(q.b.dim) - Number(p.b.dim) || RANK[p.b.level] - RANK[q.b.level] || p.i - q.i)
    .map((x) => x.b);
}

export interface ScreenStatus extends StatusSpec {
  /** Badge center on screen (anchor + offset). */
  x: number;
  y: number;
  /** Stable id for label collision ("status:ORD"). */
  id: string;
}

/**
 * Projects badges and drops the ones whose airport is on the far side of
 * the globe or far off screen (same rule as `visibleMarks`).
 */
export function visibleStatus(
  specs: readonly StatusSpec[],
  project: LiftedProjector,
  size: { width: number; height: number },
  margin = 40,
): ScreenStatus[] {
  const out: ScreenStatus[] = [];
  for (const s of specs) {
    const p = project(s.coord, 1);
    if (!p.visible) continue;
    if (p.x < -margin || p.y < -margin || p.x > size.width + margin || p.y > size.height + margin) continue;
    const o = statusOffset(s.anchor);
    out.push({ ...s, x: p.x + o.dx, y: p.y + o.dy, id: `status:${s.codes.join('/')}` });
  }
  return out;
}

export interface StatusColors {
  caution: string;
  likelyDelays: string;
  /** Opaque halo under each badge. */
  halo: string;
}

/** Theme tokens only: never `you` (amber) or seat tier colors. */
export function statusColors(palette: Palette): StatusColors {
  return { caution: palette.caution, likelyDelays: palette.likelyDelays, halo: palette.surface };
}

/** "Likely delays at ORD, EWR. Caution at DFW." (empty string when none). */
export function statusSummary(statuses: readonly AirportStatusMark[] | undefined): string {
  if (!statuses || statuses.length === 0) return '';
  const all = worstPerCode(statuses);
  const parts: string[] = [];
  const likely = all.filter((s) => s.level === 'likelyDelays').map((s) => s.code);
  const caution = all.filter((s) => s.level === 'caution').map((s) => s.code);
  if (likely.length > 0) parts.push(`Likely delays at ${likely.join(', ')}.`);
  if (caution.length > 0) parts.push(`Caution at ${caution.join(', ')}.`);
  return parts.join(' ');
}
