/**
 * Line legend, shown only while a route is selected (DECISIONS.md "Map").
 * One combined list (Q-044): each row is a tier color drawn in that row's
 * line style, e.g. "Likely (Estimate)" with a dashed green swatch. Only the
 * tier/source combinations on the selected route are listed. Swatches are
 * line fills (allowed); all text is in the `text` token, never tier-colored.
 * Each row is one accessible element; the swatch is decorative. No weather
 * key (removed in DECISIONS.md).
 *
 * A small card that hugs its lines (John, 2026-11-01: the chip ran wide and
 * crowded the drawer). GlobeMap pins it top-left of the map, far from the
 * drawer at every height, and frames the route below it, so it never sits
 * on a line. Screens can pass `showLegend={false}` and place this instead.
 *
 * Folded to a small "Map key" chip until tapped (John, 2026-11-03: the open card
 * covered a third of a squished map). The chip shows one swatch per line so it
 * still hints at the colors; tapping opens the full list, tapping again folds it.
 *
 * Opened, it reads as plain words for a new user (round 126, John): a title, what the line color
 * means (each chance word with a short meaning), what solid and dashed mean, and how to read the
 * seat circles on the route card ("10/4": 10 open seats, 4 people listed).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, textStyles, useColors } from '@/theme';

import { hexToRgb, rgba } from './globeColors';
import { DASH_PATTERN, legendEntries, TIER_LABEL } from './routeModel';
import type { RouteLine, SeatTier } from './types';

const SWATCH_W = 16;
const SWATCH_H = 3;

function SolidSwatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

function DashedSwatch({ color }: { color: string }) {
  // Scaled-down 8/6 dash so the key matches the map.
  const on = DASH_PATTERN[0] * 0.5;
  const off = DASH_PATTERN[1] * 0.5;
  const n = Math.floor((SWATCH_W + off) / (on + off));
  return (
    <View style={[styles.swatchRow, { width: SWATCH_W }]}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ width: on, height: SWATCH_H, borderRadius: 1.5, backgroundColor: color, marginRight: off }} />
      ))}
    </View>
  );
}

export interface RouteLegendProps {
  route: RouteLine;
  /** Open state, when the parent controls it. Uncontrolled (starts folded) without it. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/** What each chance word means, in plain words, for a first-time user (round 126, John). */
export const TIER_MEANING: Record<SeatTier, string> = {
  wide: 'lots of open seats',
  good: 'good odds of a seat',
  okay: 'could go either way',
  tight: 'only a few seats left',
  full: 'no open seats',
  unknown: 'no seat info yet',
};

/** What each line style means. */
const STYLE_MEANING = {
  solid: 'Solid line: seats someone reported',
  dashed: 'Dashed line: our estimate',
};

/** The seat circles on the route card, explained by example. */
export const SEAT_CIRCLE_EXAMPLE = '10/4';
export const SEAT_CIRCLE_MEANING = '10 open seats, 4 people listed';

/** The open key's rows, in order, for the card and for VoiceOver. */
export function keyRows(route: RouteLine) {
  const rows = legendEntries(route);
  // One color row per chance word on this route; typical loads and no data share the gray.
  const tiers: SeatTier[] = [];
  for (const r of rows) if (!tiers.includes(r.tier)) tiers.push(r.tier);
  const colors = tiers.map((tier) => {
    const typicalOnly = rows.every((r) => r.tier !== tier || r.source === 'typical');
    return {
      tier,
      label: typicalOnly ? 'Gray' : TIER_LABEL[tier].replace('\u00a0', ' '),
      meaning: typicalOnly ? 'a typical day, no live count' : TIER_MEANING[tier],
    };
  });
  const lineStyles: ('solid' | 'dashed')[] = [];
  if (rows.some((r) => !r.dashed)) lineStyles.push('solid');
  if (rows.some((r) => r.dashed)) lineStyles.push('dashed');
  return { colors, lineStyles };
}

export function RouteLegend({ route, open: openProp, onToggle }: RouteLegendProps) {
  const c = useColors();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const toggle = () => {
    setOpenState(!open);
    onToggle?.(!open);
  };
  const rows = legendEntries(route);
  const textStyle = [textStyles.small, styles.label, { color: c.text }];
  const boxStyle = [styles.box, { backgroundColor: rgba(hexToRgb(c.surface), 0.94), borderColor: c.line }];
  const swatch = (row: (typeof rows)[number]) =>
    row.dashed ? <DashedSwatch color={c[row.tier]} /> : <SolidSwatch color={c[row.tier]} />;

  if (!open) {
    return (
      <Pressable
        onPress={toggle}
        hitSlop={8}
        style={({ pressed }) => [boxStyle, styles.chip, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Map key"
        accessibilityHint="Explains the line colors, line styles and seat circles"
        accessibilityState={{ expanded: false }}
        testID="route-legend">
        <View style={styles.chipSwatches}>
          {rows.map((row) => (
            <View key={row.key}>{swatch(row)}</View>
          ))}
        </View>
        <Text style={textStyle}>Map key</Text>
      </Pressable>
    );
  }

  // Opened, the key explains itself at a glance (round 126, John: "I'm not sure what it means as a new
  // user"): a title, what the color means, what the line style means, and how to read a seat circle.
  const key = keyRows(route);
  const heading = [textStyles.small, styles.heading, { color: c.muted }];
  const spoken = [
    'Map key.',
    'Line color is your chance of a seat:',
    ...key.colors.map((r) => `${r.label}, ${r.meaning}.`),
    ...key.lineStyles.map((s) => `${STYLE_MEANING[s]}.`),
    `On the route card, a seat circle like ${SEAT_CIRCLE_EXAMPLE} means ${SEAT_CIRCLE_MEANING}.`,
  ].join(' ');
  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [boxStyle, styles.open, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Folds the key"
      accessibilityState={{ expanded: true }}
      testID="route-legend">
      <Text style={[textStyles.small, styles.title, { color: c.text }]}>Map key</Text>
      <Text style={heading}>Line color is your chance of a seat</Text>
      {key.colors.map((r) => (
        <View key={r.tier} style={styles.row} testID="legend-color">
          <SolidSwatch color={c[r.tier]} />
          <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.muted }]}>
            <Text style={[styles.strong, { color: c.text }]}>{r.label}</Text>
            {`  ${r.meaning}`}
          </Text>
        </View>
      ))}
      <Text style={[heading, styles.section]}>Line style</Text>
      {key.lineStyles.map((s) => (
        <View key={s} style={styles.row} testID="legend-style">
          {s === 'dashed' ? <DashedSwatch color={c.muted} /> : <SolidSwatch color={c.muted} />}
          <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.text }]}>{STYLE_MEANING[s]}</Text>
        </View>
      ))}
      <Text style={[heading, styles.section]}>Seat circles on the route card</Text>
      <View style={styles.row} testID="legend-seats">
        <View style={[styles.seatDot, { borderColor: c.muted }]}>
          <Text style={[styles.seatDotText, { color: c.text }]}>{SEAT_CIRCLE_EXAMPLE}</Text>
        </View>
        <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.text }]}>{SEAT_CIRCLE_MEANING}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Hugs its widest line; one line per key, stacked.
  box: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
  },
  chipSwatches: { gap: 2 },
  pressed: { opacity: 0.8 },
  // The open key wraps its words rather than running across the map.
  open: { maxWidth: 236, paddingVertical: 8, gap: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17 },
  heading: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  section: { marginTop: 4 },
  rowText: { flexShrink: 1 },
  strong: { fontFamily: fonts.bodyBold },
  seatDot: {
    minWidth: 30,
    height: 20,
    paddingHorizontal: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatDotText: { fontFamily: fonts.monoMedium, fontSize: 9, lineHeight: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 12, lineHeight: 16 },
  swatch: {
    width: SWATCH_W,
    height: SWATCH_H,
    borderRadius: 1.5,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
