/**
 * Airport marks and their labels (pure, no Skia, no React). Backlog item 9.
 *
 * From reference/globe-prototype-v9.1.html (drawHome, drawAltHome,
 * drawHomeMark, drawEndMark, the "airports" block of drawRoutes):
 * - Home: amber house pin (the first home); further homes are an outline
 *   variant. Homes close together (same metro) share one pin and label,
 *   "JFK/LGA". Amber = "you" only, so only home pins use the `you` token.
 * - Origin: filled accent dot with a halo ring.
 * - Destination(s): hollow accent ring.
 * - Selected route only: small rings + labels on its other airports
 *   (connections, nearby-airport ends).
 * - A code shown as a home pin gets no other mark (the pin is on top).
 *
 * Label placement replaces the prototype's hard-coded per-airport list with
 * `placeLabels`: right of the mark, else left when that would overflow the
 * visible area, nudged up/down when it would overlap a placed label or mark.
 */
import { geoDistance } from 'd3-geo';

import type { ColorScheme, Palette } from '@/theme';

import type { LiftedProjector, ArcSample } from './arcs';
import { hexToRgb, rgba } from './globeColors';
import type { MapAirport, MapInsets, LonLat, RouteLine } from './types';

export type MarkKind = 'home' | 'altHome' | 'origin' | 'destination' | 'stop';

export interface MarkSpec {
  kind: MarkKind;
  /** Primary code (first of a home group). */
  code: string;
  /** Text drawn next to the mark ("BNA", "JFK/LGA"). */
  label: string;
  coord: LonLat;
}

/** Homes closer than this (radians, ~100 km) share a pin (prototype: 0.016). */
export const HOME_GROUP_RAD = 0.016;

export interface MarkSetInput {
  homeAirports?: readonly MapAirport[];
  origin?: MapAirport | null;
  destinations?: readonly MapAirport[];
  /** The selected route, if any: adds its other airports as small marks. */
  selectedRoute?: RouteLine | null;
}

/** Groups homes that are close together, keeping the given order. */
export function groupHomes(homes: readonly MapAirport[]): MapAirport[][] {
  const groups: MapAirport[][] = [];
  const seen = new Set<string>();
  for (const h of homes) {
    if (seen.has(h.code)) continue;
    const head = h.coord;
    const group = homes.filter(
      (k) =>
        !seen.has(k.code) &&
        geoDistance([head[0], head[1]], [k.coord[0], k.coord[1]]) < HOME_GROUP_RAD,
    );
    const codes = new Set<string>();
    const unique = group.filter((k) => (codes.has(k.code) ? false : (codes.add(k.code), true)));
    for (const k of unique) seen.add(k.code);
    groups.push(unique);
  }
  return groups;
}

/**
 * Marks to draw, back to front: stops, destinations, origin, alt homes,
 * main home (on top). Each airport code appears once.
 */
export function markSet(input: MarkSetInput): MarkSpec[] {
  const homes = input.homeAirports ?? [];
  const taken = new Set<string>();
  const homeMarks: MarkSpec[] = groupHomes(homes).map((g, i) => ({
    kind: i === 0 ? 'home' : 'altHome',
    code: g[0].code,
    label: g.map((k) => k.code).join('/'),
    coord: g[0].coord,
  }));
  for (const h of homes) taken.add(h.code);

  let originMark: MarkSpec | null = null;
  if (input.origin && !taken.has(input.origin.code)) {
    originMark = { kind: 'origin', code: input.origin.code, label: input.origin.code, coord: input.origin.coord };
    taken.add(input.origin.code);
  }

  const destMarks: MarkSpec[] = [];
  for (const d of input.destinations ?? []) {
    if (taken.has(d.code)) continue;
    taken.add(d.code);
    destMarks.push({ kind: 'destination', code: d.code, label: d.code, coord: d.coord });
  }

  const stopMarks: MarkSpec[] = [];
  for (const leg of input.selectedRoute?.legs ?? []) {
    for (const [code, coord] of [
      [leg.fromCode, leg.from],
      [leg.toCode, leg.to],
    ] as const) {
      if (taken.has(code)) continue;
      taken.add(code);
      stopMarks.push({ kind: 'stop', code, label: code, coord });
    }
  }

  // Alt homes under the main home: reverse so the main home draws last.
  return [...stopMarks, ...destMarks, ...(originMark ? [originMark] : []), ...homeMarks.slice(1), ...homeMarks.slice(0, 1)];
}

/** Sizes in pt (prototype values). */
export const MARK = {
  home: { r: 9, stroke: 1.5, shadowSigma: 2, shadowAlpha: 0.25, glyphWidth: 1.4 },
  altHome: { r: 7, stroke: 1.5, glyphWidth: 1.4 },
  origin: { r: 3.6, stroke: 1.6 },
  destination: { r: 4.5, stroke: 2.2 },
  stop: { r: 3.2, stroke: 1.6 },
} as const;

/** Outer radius of a mark (for label gaps and overlap checks). */
export function markExtent(kind: MarkKind): number {
  const m = MARK[kind];
  return m.r + m.stroke / 2;
}

export interface LabelFont {
  weight: 600 | 700;
  size: number;
  /** Halo stroke width under the fill. */
  halo: number;
}

/** Label type per mark (prototype: ends 700 12.5, others 600 11.5, home 700 12.5, alt home 600 11). */
export const LABEL_FONT: Record<MarkKind, LabelFont> = {
  home: { weight: 700, size: 12.5, halo: 3.5 },
  altHome: { weight: 600, size: 11, halo: 3 },
  origin: { weight: 700, size: 12.5, halo: 3.5 },
  destination: { weight: 700, size: 12.5, halo: 3.5 },
  stop: { weight: 600, size: 11.5, halo: 3.5 },
};

/** Gap from the mark center to the label's near edge (prototype: home 14, alt home 11, others 8). */
export const LABEL_GAP: Record<MarkKind, number> = {
  home: 14,
  altHome: 11,
  origin: 8,
  destination: 8,
  stop: 8,
};

/**
 * Vertical offsets tried in order (label center relative to the mark). Homes
 * sit level with the pin; small marks sit a little above (prototype -6) and
 * drop below (+9) when that spot is taken.
 */
export const LABEL_DY: Record<MarkKind, readonly number[]> = {
  home: [0, -12, 12],
  altHome: [0, -10, 10],
  origin: [-6, 9],
  destination: [-6, 9],
  stop: [-6, 9],
};

/** Space kept free on the right for map buttons (prototype home rule: W - 66). */
export const LABEL_RIGHT_MARGIN = 66;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelRequest {
  id: string;
  kind: MarkKind;
  /** Mark center on screen. */
  x: number;
  y: number;
  /** Text size in pt. */
  width: number;
  height: number;
}

export interface PlacedLabel {
  id: string;
  /** 'right' = text starts right of the mark; 'left' = text ends left of it. */
  side: 'right' | 'left';
  /** Text box left edge. */
  x: number;
  /** Text vertical center. */
  y: number;
  dy: number;
  box: Box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Horizontal limits labels must stay inside: visible area minus the button margin. */
export function labelBounds(width: number, insets: MapInsets): { left: number; right: number } {
  return { left: insets.left, right: width - insets.right - LABEL_RIGHT_MARGIN };
}

/** Halo width already pads the box a little; keep labels this far apart too. */
const LABEL_PAD = 1;

/**
 * Places labels in the given order (put homes first). Each label tries the
 * right side, then the left when the right would cross `bounds.right` (or
 * the left would fit and the right would not). On each side the dy offsets
 * are tried until one does not overlap a placed label or another mark; if
 * none is free, the first candidate is used.
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  bounds: { left: number; right: number },
  marks: readonly { id: string; x: number; y: number; r: number }[] = [],
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const q of requests) {
    const gap = LABEL_GAP[q.kind];
    const rightX = q.x + gap;
    const leftX = q.x - gap - q.width;
    const rightFits = rightX + q.width <= bounds.right;
    const leftFits = leftX >= bounds.left;
    const sides: ('right' | 'left')[] = rightFits || !leftFits ? ['right', 'left'] : ['left', 'right'];
    // Only try the other side when it fits.
    const usable = sides.filter((s, i) => i === 0 || (s === 'left' ? leftFits : rightFits));

    const candidates: PlacedLabel[] = [];
    for (const side of usable) {
      for (const dy of LABEL_DY[q.kind]) {
        const x = side === 'right' ? rightX : leftX;
        const y = q.y + dy;
        candidates.push({
          id: q.id,
          side,
          x,
          y,
          dy,
          box: {
            x0: x - LABEL_PAD,
            y0: y - q.height / 2 - LABEL_PAD,
            x1: x + q.width + LABEL_PAD,
            y1: y + q.height / 2 + LABEL_PAD,
          },
        });
      }
    }
    const free = candidates.find(
      (c) =>
        !placed.some((p) => overlaps(p.box, c.box)) &&
        !marks.some(
          (m) => m.id !== q.id && overlaps(c.box, { x0: m.x - m.r, y0: m.y - m.r, x1: m.x + m.r, y1: m.y + m.r }),
        ),
    );
    placed.push(free ?? candidates[0]);
  }
  return placed;
}

/** Label order: main home, alt homes, origin, destinations, stops. */
export function labelOrder(marks: readonly MarkSpec[]): MarkSpec[] {
  const rank: Record<MarkKind, number> = { home: 0, altHome: 1, origin: 2, destination: 3, stop: 4 };
  return marks
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank[a.m.kind] - rank[b.m.kind] || a.i - b.i)
    .map((x) => x.m);
}

export interface ScreenMark extends MarkSpec {
  x: number;
  y: number;
}

/**
 * Projects marks for a camera and drops the ones on the far side of the
 * globe (surface points, clipAngle 90) or far off screen.
 */
export function visibleMarks(
  marks: readonly MarkSpec[],
  project: LiftedProjector,
  size: { width: number; height: number },
  margin = 40,
): ScreenMark[] {
  const out: ScreenMark[] = [];
  for (const m of marks) {
    const p = project(m.coord, 1);
    if (!p.visible) continue;
    if (p.x < -margin || p.y < -margin || p.x > size.width + margin || p.y > size.height + margin) continue;
    out.push({ ...m, x: p.x, y: p.y });
  }
  return out;
}

// ---------------------------------------------------------------- house glyph

/** Roof polyline and walls polyline for a house glyph in a pin of radius r. */
export function houseGlyph(x: number, y: number, r: number): { roof: Pt[]; walls: Pt[] } {
  const k = r / 9;
  return {
    roof: [
      { x: x - 4.6 * k, y: y - 0.2 * k },
      { x, y: y - 4.4 * k },
      { x: x + 4.6 * k, y: y - 0.2 * k },
    ],
    walls: [
      { x: x - 3.2 * k, y: y - 1.2 * k },
      { x: x - 3.2 * k, y: y + 3.6 * k },
      { x: x + 3.2 * k, y: y + 3.6 * k },
      { x: x + 3.2 * k, y: y - 1.2 * k },
    ],
  };
}

// ---------------------------------------------------------------- chevrons

interface Pt {
  x: number;
  y: number;
}

/** Where along a selected leg chevrons sit (prototype drawChevronsAlong). */
export const CHEVRON = {
  ts: [0.2, 0.66, 0.88] as readonly number[],
  size: 4.5,
  width: 2.2,
  haloWidth: 5,
  haloAlpha: 0.95,
} as const;

export interface Chevron {
  x: number;
  y: number;
  /** Direction of travel on screen, radians (atan2). */
  angle: number;
}

/**
 * Chevron anchors along the drawn (lifted) arc, pointing the way the flight
 * goes. A chevron is skipped when either of its two sample points is on the
 * far side.
 */
export function chevronsAlong(
  samples: readonly ArcSample[],
  project: LiftedProjector,
  ts: readonly number[] = CHEVRON.ts,
): Chevron[] {
  if (samples.length < 2) return [];
  const out: Chevron[] = [];
  for (const t of ts) {
    const i = Math.min(samples.length - 2, Math.max(0, Math.round(t * (samples.length - 1))));
    const a = project(samples[i].ll, samples[i].lift);
    const b = project(samples[i + 1].ll, samples[i + 1].lift);
    if (!a.visible || !b.visible) continue;
    out.push({ x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
}

/** The chevron polyline: (-0.7s,-s) -> (0.5s,0) -> (-0.7s,s), rotated to the travel direction. */
export function chevronPoints(c: Chevron, size: number = CHEVRON.size): Pt[] {
  const cos = Math.cos(c.angle);
  const sin = Math.sin(c.angle);
  return [
    [-0.7 * size, -size],
    [0.5 * size, 0],
    [-0.7 * size, size],
  ].map(([u, v]) => ({ x: c.x + u * cos - v * sin, y: c.y + u * sin + v * cos }));
}

// ---------------------------------------------------------------- colors

export interface MarkColors {
  /** Main home pin fill and alt home stroke/glyph: the `you` token. */
  you: string;
  /** House glyph and ring on the filled main pin. */
  homeGlyph: string;
  homeRing: string;
  /** Fill of hollow marks (alt home, rings) and the halo under labels/chevrons. */
  halo: string;
  /** Origin fill, destination ring. */
  accent: string;
  /** Stop ring and label text. */
  label: string;
  /** Halo under chevrons (alpha CHEVRON.haloAlpha). */
  chevronHalo: string;
  /** Soft shadow under the main pin. */
  homeShadow: string;
}

/** Halo alpha, same as the selected-route halo (routeModel LINE.haloAlpha). */
export const LABEL_HALO_ALPHA = 0.9;

/**
 * Mark colors from theme tokens. The glyph and ring on the amber pin use
 * `onAccent`: white on #c46a10 in light (3.9:1), #0a1530 on #ffb25a in dark
 * (10.1:1); white on the dark-mode amber would be only ~1.8:1. The glyph
 * is a graphic, so the WCAG target is 3:1 (labels next to it are text, 4.5:1).
 */
export function markColors(_scheme: ColorScheme, palette: Palette): MarkColors {
  const halo = rgba(hexToRgb(palette.surface), LABEL_HALO_ALPHA);
  return {
    you: palette.you,
    homeGlyph: palette.onAccent,
    homeRing: palette.onAccent,
    halo,
    accent: palette.accent,
    label: palette.text,
    chevronHalo: rgba(hexToRgb(palette.surface), CHEVRON.haloAlpha),
    homeShadow: 'rgba(0,0,0,0.25)',
  };
}

// ---------------------------------------------------------------- accessibility

/** "Home BNA. Origin DFW. Destination LAX." (empty string when there is nothing). */
export function marksSummary(input: Omit<MarkSetInput, 'selectedRoute'>): string {
  const parts: string[] = [];
  const homes = (input.homeAirports ?? []).map((h) => h.code);
  if (homes.length > 0) parts.push(`${homes.length > 1 ? 'Homes' : 'Home'} ${homes.join(', ')}.`);
  if (input.origin) parts.push(`Origin ${input.origin.code}.`);
  const dests = (input.destinations ?? []).map((d) => d.code);
  if (dests.length > 0) parts.push(`${dests.length > 1 ? 'Destinations' : 'Destination'} ${dests.join(', ')}.`);
  return parts.join(' ');
}
