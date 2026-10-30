/**
 * Leg flight-time labels on the selected route (pure, no Skia, no React).
 * Backlog item 15, DECISIONS.md "Map" (Q-041, John: A).
 *
 * - Selected route only, one label per leg, "H:MM" (no leading zero on
 *   hours) from arriveUtc - departUtc, rounded to the nearest minute.
 *   Overview lines and ghosts get none; no selection = no labels.
 * - Placed at t = 0.5 of the leg's drawn (lifted) arc; chevrons sit at
 *   0.2 / 0.66 / 0.88. Hidden when that point is on the far side.
 * - IATA labels and marks win: a time label is nudged up or down off the
 *   line, and hidden when every spot overlaps a label, mark, badge, the
 *   legend, another time label or the edge of the visible area.
 * - Not interactive: drawn in the marks picture, never hit tested.
 */
import type { Palette } from '@/theme';

import type { ArcSample, LiftedProjector } from './arcs';
import { hexToRgb, rgba } from './globeColors';
import { labelBounds, type Box } from './marks';
import type { MapInsets, RouteLine } from './types';

/** Where along the lifted arc the label sits. */
export const LEG_TIME_T = 0.5;

/**
 * Pill style (provisional spec-keeper defaults, DECISIONS.md "Map"): Manrope
 * 600 12/16, `muted` text on a `surface` pill at 0.85.
 */
export const LEG_TIME_PILL = {
  fontSize: 12,
  /** Pill height = line height. */
  height: 16,
  padX: 5,
  radius: 8,
  alpha: 0.85,
  /** Extra space kept between the pill and anything it must not touch. */
  pad: 1,
} as const;

/** Vertical offsets tried in order (pill center relative to the line point). */
export const LEG_TIME_DY: readonly number[] = [0, -(LEG_TIME_PILL.height + 4), LEG_TIME_PILL.height + 4];

const MINUTE = 60_000;

/** Whole minutes between two epoch-ms times, or null when unknown or negative. */
export function legMinutes(departUtc?: number, arriveUtc?: number): number | null {
  if (departUtc == null || arriveUtc == null) return null;
  if (!Number.isFinite(departUtc) || !Number.isFinite(arriveUtc)) return null;
  const ms = arriveUtc - departUtc;
  if (ms <= 0) return null;
  return Math.round(ms / MINUTE);
}

/** "2:35", "0:45", "10:05". */
export function formatLegDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${mm < 10 ? '0' : ''}${mm}`;
}

/** "2 hours 35 minutes", "1 hour", "45 minutes", "1 hour 1 minute". */
export function spokenLegDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (mm > 0 || h === 0) parts.push(`${mm} ${mm === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

export interface LegTimeSpec {
  legId: string;
  /** "2:35" */
  text: string;
  /** "DFW to ORD, flight time 2 hours 35 minutes" */
  spoken: string;
  legIndex: number;
}

/**
 * Labels to draw: one per leg of the selected route that has both times.
 * None without a selection.
 */
export function legTimeSpecs(selected: RouteLine | null | undefined): LegTimeSpec[] {
  if (!selected) return [];
  const out: LegTimeSpec[] = [];
  selected.legs.forEach((leg, legIndex) => {
    const min = legMinutes(leg.departUtc, leg.arriveUtc);
    if (min == null) return;
    out.push({
      legId: leg.id,
      text: formatLegDuration(min),
      spoken: `${leg.fromCode} to ${leg.toCode}, flight time ${spokenLegDuration(min)}`,
      legIndex,
    });
  });
  return out;
}

/**
 * Accessibility sentences for the selected route's legs. Empty string when none.
 */
export function legTimesSummary(selected: RouteLine | null | undefined): string {
  return legTimeSpecs(selected)
    .map((s) => `${s.spoken}.`)
    .join(' ');
}

/** The label's point on the drawn arc, or null when it is on the far side. */
export function legTimeAnchor(
  samples: readonly ArcSample[],
  project: LiftedProjector,
  t: number = LEG_TIME_T,
): { x: number; y: number } | null {
  if (samples.length === 0) return null;
  const i = Math.min(samples.length - 1, Math.max(0, Math.round(t * (samples.length - 1))));
  const p = project(samples[i].ll, samples[i].lift);
  return p.visible ? { x: p.x, y: p.y } : null;
}

export interface LegTimeRequest {
  id: string;
  /** Point on the line; null = far side (hidden). */
  anchor: { x: number; y: number } | null;
  /** Pill size in pt. */
  width: number;
  height: number;
}

export interface PlacedLegTime {
  id: string;
  /** Pill center. */
  x: number;
  y: number;
  box: Box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function inside(a: Box, area: Box): boolean {
  return a.x0 >= area.x0 && a.y0 >= area.y0 && a.x1 <= area.x1 && a.y1 <= area.y1;
}

/**
 * Places pills centered on their anchor, else nudged up, else down. A pill
 * is dropped when its anchor is on the far side, when no spot is free of
 * `obstacles` (IATA labels, marks, badges, legend) and earlier pills, or
 * when no spot fits inside `area` (the visible map minus button margin).
 * Unlike IATA labels there is no fallback: hidden beats covering a label.
 */
export function placeLegTimes(
  requests: readonly LegTimeRequest[],
  obstacles: readonly Box[],
  area: Box,
  dys: readonly number[] = LEG_TIME_DY,
): PlacedLegTime[] {
  const placed: PlacedLegTime[] = [];
  const pad = LEG_TIME_PILL.pad;
  for (const q of requests) {
    if (!q.anchor) continue;
    for (const dy of dys) {
      const x = q.anchor.x;
      const y = q.anchor.y + dy;
      const box: Box = {
        x0: x - q.width / 2 - pad,
        y0: y - q.height / 2 - pad,
        x1: x + q.width / 2 + pad,
        y1: y + q.height / 2 + pad,
      };
      if (!inside(box, area)) continue;
      if (obstacles.some((o) => overlaps(o, box))) continue;
      if (placed.some((p) => overlaps(p.box, box))) continue;
      placed.push({ id: q.id, x, y, box });
      break;
    }
  }
  return placed;
}

/**
 * Where pills may sit: the visible map (inside `insets`), minus the map
 * button margin on the right that IATA labels also keep free.
 */
export function legTimeArea(width: number, height: number, insets: MapInsets): Box {
  const b = labelBounds(width, insets);
  return { x0: b.left, y0: insets.top, x1: b.right, y1: height - insets.bottom };
}

export interface LegTimeColors {
  /** `muted`, never a tier color. */
  text: string;
  /** `surface` at LEG_TIME_PILL.alpha. */
  pill: string;
}

export function legTimeColors(palette: Palette): LegTimeColors {
  return { text: palette.muted, pill: rgba(hexToRgb(palette.surface), LEG_TIME_PILL.alpha) };
}
