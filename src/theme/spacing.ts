/** Spacing, radius and tap targets, all confirmed in DECISIONS.md. */

export const spacing = {
  page: 16,
  section: 12,
  group: 8,
  rowY: 10,
  rowX: 12,
} as const;

/** Tighter corners for the Departure board look (round 117; was 12 / 14 / 26). */
export const radius = {
  sm: 6,
  md: 10,
  lg: 22,
} as const;

/** Minimum tap target, in points. */
export const minTapTarget = 44;
