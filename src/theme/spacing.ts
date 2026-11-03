/** Spacing, radius and tap targets, all confirmed in DECISIONS.md. */

export const spacing = {
  page: 16,
  section: 12,
  group: 8,
  rowY: 10,
  rowX: 12,
} as const;

/** Soft, rounder corners for the Clean look (round 120): leg boxes and chips 12, cards 18, sheets 26. */
export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
} as const;

/** Minimum tap target, in points. */
export const minTapTarget = 44;
