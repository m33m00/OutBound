/**
 * Pure route logic for the map (no Skia, no React): which routes are drawn,
 * how they look, path grouping and what a tap selects.
 *
 * Rules (DECISIONS.md "Map"):
 * - Results show the top 10 routes of the current sort.
 * - Overview (nothing selected): thin neutral gray.
 * - Selected route: tier color per leg; solid = reported, dashed = the rest.
 *   Typical loads are neutral, so typical/unknown sources draw unknown gray.
 * - Other routes while one is selected: faint ghosts.
 * - Tap a ghost: earliest-arriving option on that path (see types.ts).
 * - Never amber (amber = "you" only); colors come from theme tokens.
 */
import type { ColorScheme, Palette } from '@/theme';

import { hexToRgb, rgba } from './globeColors';
import { MAP_ROUTE_LIMIT, type LineSource, type RouteLeg, type RouteLine, type SeatTier } from './types';

/** "DFW>ORD|ORD>LGA": the airport path of a route. */
export function routePathKey(route: RouteLine): string {
  return route.legs.map((l) => `${l.fromCode}>${l.toCode}`).join('|');
}

/** Same airports either direction: ghosts are deduped on this. */
export function legPairKey(leg: RouteLeg): string {
  return leg.fromCode < leg.toCode ? `${leg.fromCode}-${leg.toCode}` : `${leg.toCode}-${leg.fromCode}`;
}

/** A leg that would draw nothing (same airport or same point). */
export function isDrawableLeg(leg: RouteLeg): boolean {
  if (leg.fromCode === leg.toCode) return false;
  return leg.from[0] !== leg.to[0] || leg.from[1] !== leg.to[1];
}

/** Path key -> route ids in the given (arrival) order. */
export function groupByPath(routes: readonly RouteLine[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const r of routes) {
    const key = routePathKey(r);
    const ids = groups.get(key);
    if (ids) ids.push(r.id);
    else groups.set(key, [r.id]);
  }
  return groups;
}

/**
 * Routes to draw: the first MAP_ROUTE_LIMIT, plus the selected route if it is
 * further down the list (it was picked from the list, so it must show).
 */
export function drawnRoutes(
  routes: readonly RouteLine[],
  selectedId: string | null,
  limit = MAP_ROUTE_LIMIT,
): RouteLine[] {
  const top = routes.slice(0, limit);
  if (selectedId && !top.some((r) => r.id === selectedId)) {
    const sel = routes.find((r) => r.id === selectedId);
    if (sel) top.push(sel);
  }
  return top;
}

/**
 * The route a tap on `hitId` selects: the first route in `routes` (earliest
 * arriving) on the same airport path. Unknown id -> null.
 */
export function resolveTapSelection(routes: readonly RouteLine[], hitId: string): string | null {
  const hit = routes.find((r) => r.id === hitId);
  if (!hit) return null;
  const key = routePathKey(hit);
  return routes.find((r) => routePathKey(r) === key)?.id ?? null;
}

/** What to tell the screen after a tap. `undefined` = nothing changes. */
export function nextSelection(
  routes: readonly RouteLine[],
  selectedId: string | null,
  hitId: string | null,
): string | null | undefined {
  if (hitId == null) return selectedId != null ? null : undefined;
  if (hitId === selectedId) return undefined;
  const id = resolveTapSelection(routes, hitId);
  return id == null || id === selectedId ? undefined : id;
}

export type LineRole = 'overview' | 'selected' | 'ghost';

/** Tier token a selected leg is drawn in. Typical/unknown sources are neutral. */
export function legTier(leg: Pick<RouteLeg, 'tier' | 'source'>): SeatTier {
  if (leg.source === 'typical' || leg.source === 'unknown') return 'unknown';
  return leg.tier;
}

export function isDashedSource(source: LineSource): boolean {
  return source !== 'reported';
}

/** Dash pattern for non-reported selected legs (v9.1 prototype: 8 on, 6 off). */
export const DASH_PATTERN: readonly number[] = [8, 6];

/** Widths and alphas (v9.1 prototype drawRoutes, adapted to theme tokens). */
export const LINE = {
  /** Neutral widths; alphas per scheme are in NEUTRAL_LINE. */
  overview: { width: 1.5 },
  ghost: { width: 1.5 },
  selected: { width: 3.6, alpha: 1 },
  /** Light halo under the selected line so it reads over land and borders. */
  haloExtra: 3.4,
  haloAlpha: 0.9,
  /** Soft glow in the tier color under reported legs (canvas shadowBlur 10). */
  glowSigma: 5,
  glowAlpha: 0.55,
  /** Ground shadow under the lifted arc: width factor, alpha reported / other. */
  shadowWidth: 0.9,
  shadowAlphaReported: 0.9,
  shadowAlphaOther: 0.45,
} as const;

export interface LegStyle {
  /** Color with alpha applied. */
  color: string;
  width: number;
  dash: readonly number[] | null;
  /** Halo stroke drawn under the line, or null. */
  halo: { color: string; width: number } | null;
  /** Blurred glow in the line color, or null. */
  glow: { color: string; sigma: number } | null;
  /** Ground-shadow alpha multiplier, or null for no ground shadow. */
  shadowAlpha: number | null;
}

/**
 * Neutral line token and alphas for overview and ghosts (not a tier, never
 * amber). Dark uses `text` because `muted` over dark land (#4a767c) is too
 * low-contrast (design-critic, item 4). Ghosts stay clearly fainter.
 */
export const NEUTRAL_LINE = {
  light: { token: 'muted', overview: 0.9, ghost: 0.3 },
  dark: { token: 'text', overview: 0.7, ghost: 0.3 },
} as const satisfies Record<ColorScheme, { token: keyof Palette; overview: number; ghost: number }>;

export function legStyle(
  leg: Pick<RouteLeg, 'tier' | 'source'>,
  role: LineRole,
  palette: Palette,
  scheme: ColorScheme,
): LegStyle {
  if (role !== 'selected') {
    const neutral = NEUTRAL_LINE[scheme];
    return {
      color: rgba(hexToRgb(palette[neutral.token]), neutral[role]),
      width: LINE[role].width,
      dash: null,
      halo: null,
      glow: null,
      shadowAlpha: null,
    };
  }
  const reported = !isDashedSource(leg.source);
  const tierHex = palette[legTier(leg)];
  return {
    color: tierHex,
    width: LINE.selected.width,
    dash: reported ? null : DASH_PATTERN,
    halo: {
      color: rgba(hexToRgb(palette.surface), LINE.haloAlpha),
      width: LINE.selected.width + LINE.haloExtra,
    },
    glow: reported ? { color: rgba(hexToRgb(tierHex), LINE.glowAlpha), sigma: LINE.glowSigma } : null,
    shadowAlpha: reported ? LINE.shadowAlphaReported : LINE.shadowAlphaOther,
  };
}

/** One leg as the map draws it. */
export interface DrawLeg {
  routeId: string;
  leg: RouteLeg;
  role: LineRole;
}

/**
 * Legs to draw, back to front. Neutral lines are deduped by airport pair (so
 * shared legs do not stack alpha) and skip pairs the selected route draws.
 * The selected route's legs come last, in order.
 */
export function drawLegs(drawn: readonly RouteLine[], selectedId: string | null): DrawLeg[] {
  const selected = selectedId ? drawn.find((r) => r.id === selectedId) : undefined;
  const role: LineRole = selected ? 'ghost' : 'overview';
  const seen = new Set<string>();
  if (selected) for (const l of selected.legs) seen.add(legPairKey(l));
  const out: DrawLeg[] = [];
  for (const r of drawn) {
    if (r === selected) continue;
    for (const leg of r.legs) {
      if (!isDrawableLeg(leg)) continue;
      const key = legPairKey(leg);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ routeId: r.id, leg, role });
    }
  }
  if (selected) {
    for (const leg of selected.legs) {
      if (isDrawableLeg(leg)) out.push({ routeId: selected.id, leg, role: 'selected' });
    }
  }
  return out;
}

/** Display order of tiers in the legend. */
export const TIER_ORDER: readonly SeatTier[] = ['wide', 'good', 'okay', 'tight', 'full', 'unknown'];

export const TIER_LABEL: Record<SeatTier, string> = {
  wide: 'Wide open',
  good: 'Good',
  okay: 'Okay',
  tight: 'Tight',
  full: 'Full',
  unknown: 'Unknown',
};

/** Row-text qualifier per line source (DECISIONS.md "Map", Q-044). */
const SOURCE_LABEL: Record<Exclude<LineSource, 'typical'>, string> = {
  reported: 'Reported',
  estimate: 'Estimate',
  unknown: 'No data',
};

/** Row order within a tier: reported first, then estimate, typical, no report. */
const SOURCE_ORDER: readonly LineSource[] = ['reported', 'estimate', 'typical', 'unknown'];

/** One combined legend row: a tier color drawn in one line style. */
export interface LegendEntry {
  /** Stable key, e.g. "good:estimate". */
  key: string;
  /** Tier token the swatch is drawn in (typical/unknown sources are `unknown`). */
  tier: SeatTier;
  source: LineSource;
  /** Swatch line style: solid = reported, dashed otherwise. */
  dashed: boolean;
  /** Visible row text, e.g. "Good (Estimate)". Typical loads carry no tier word. */
  label: string;
  /** Full spoken label, e.g. "Good, estimate, dashed line". */
  accessibilityLabel: string;
}

function makeEntry(tier: SeatTier, source: LineSource): LegendEntry {
  const dashed = isDashedSource(source);
  const style = dashed ? 'dashed line' : 'solid line';
  if (source === 'typical') {
    // Typical loads are neutral: no tier word (DECISIONS.md "Seat availability").
    return {
      key: `${tier}:${source}`,
      tier,
      source,
      dashed,
      label: 'Typical load',
      accessibilityLabel: `Typical load, ${style}`,
    };
  }
  const word = SOURCE_LABEL[source];
  return {
    key: `${tier}:${source}`,
    tier,
    source,
    dashed,
    label: `${TIER_LABEL[tier]} (${word})`,
    accessibilityLabel: `${TIER_LABEL[tier]}, ${word.toLowerCase()}, ${style}`,
  };
}

/**
 * Combined legend rows for the selected route: only the tier/source
 * combinations its drawable legs actually use, in TIER_ORDER then
 * SOURCE_ORDER, one row each.
 */
export function legendEntries(route: RouteLine): LegendEntry[] {
  const used = new Set<string>();
  for (const leg of route.legs) {
    if (!isDrawableLeg(leg)) continue;
    used.add(`${legTier(leg)}:${leg.source}`);
  }
  const out: LegendEntry[] = [];
  for (const tier of TIER_ORDER) {
    for (const source of SOURCE_ORDER) {
      if (used.has(`${tier}:${source}`)) out.push(makeEntry(tier, source));
    }
  }
  return out;
}

/** Plain-language route name for accessibility: "DFW to ORD to LGA". */
export function routeSpokenName(route: RouteLine): string {
  const codes: string[] = [];
  for (const leg of route.legs) {
    if (codes[codes.length - 1] !== leg.fromCode) codes.push(leg.fromCode);
    codes.push(leg.toCode);
  }
  return codes.join(' to ');
}
