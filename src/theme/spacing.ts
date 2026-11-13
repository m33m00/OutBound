/** Spacing, radius and tap targets, all confirmed in DECISIONS.md. */

export const spacing = {
  page: 16,
  section: 12,
  group: 8,
  rowY: 10,
  rowX: 12,
} as const;

/**
 * One corner radius everywhere (round 198, John: "One corner radius everywhere"). Every card, ticket, leg box,
 * button, field, sheet, banner, popup, tile and checkbox uses `radius.all`, nested ones too. Only pills
 * (`radius.pill`) and circles (logo badges, dots, round icons) stay fully round, since that's what makes them
 * pills and circles. Before this: leg boxes and chips 12, cards 18, sheets 26.
 */
export const RADIUS = 14;
export const radius = {
  all: RADIUS,
  pill: 999,
} as const;

/** Minimum tap target, in points. */
export const minTapTarget = 44;
