/**
 * Line legend, shown only while a route is selected (DECISIONS.md "Map").
 * One combined list (Q-044): each row is a tier color drawn in that row's
 * line style, e.g. "15 to 49 seats (Estimate)" with a dashed green swatch. Only the
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
 * seat circles on the route card ("10/4": 10 seats left, 4 people listed).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, textStyles, useColors } from '@/theme';
import { Icon } from '@/ui/Icon';

import { hexToRgb, rgba } from './globeColors';
import type { MarkKind } from './marks';
import { DASH_PATTERN, legendEntries, TIER_LABEL, type LegendEntry } from './routeModel';
import type { AirportStatusLevel, RouteLine, SeatTier } from './types';

const SWATCH_W = 16;
const SWATCH_H = 3;

function SolidSwatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

/** A canceled flight as the result cards draw it: a red stretch with an X on it (round 143). */
function CanceledSwatch({ color, disc }: { color: string; disc: string }) {
  return (
    <View style={styles.canceledSwatch} testID="legend-canceled-swatch">
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <View style={[styles.xDisc, { backgroundColor: disc, borderColor: color }]}>
        <View style={[styles.xBar, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
        <View style={[styles.xBar, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
      </View>
    </View>
  );
}

/** What the red X on a result card's route line means. */
export const CANCELED_MEANING = 'Red with an X: that flight is canceled';

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

/** The map's own marks, drawn small: the same shapes and colors as on the globe. */
function MarkSwatch({ kind }: { kind: (typeof MARK_MEANING)[number]['kind'] }) {
  const c = useColors();
  if (kind === 'origin') return <View style={[styles.markDot, { backgroundColor: c.text, borderColor: c.surface }]} />;
  if (kind === 'destination') return <View style={[styles.markRing, { borderColor: c.text }]} />;
  if (kind === 'stop') return <View style={[styles.markStop, { borderColor: c.muted }]} />;
  if (kind === 'badge-caution') return <View style={[styles.markDiamond, { backgroundColor: c.caution }]} />;
  if (kind === 'badge-likelyDelays') return <Text style={[styles.markTriangle, { color: c.likelyDelays }]}>▲</Text>;
  return (
    <View style={[styles.markHome, { backgroundColor: c.you }]}>
      <Icon name="house.fill" size={8} tintColor={c.onAccent} fallback={null} />
    </View>
  );
}

export interface RouteLegendProps {
  route: RouteLine;
  /** The marks drawn on the map now, so the key explains each one (round 136, John). */
  marks?: readonly MarkKind[];
  /** The airport weather badges on this route. */
  badges?: readonly AirportStatusLevel[];
  /** Open state, when the parent controls it. Uncontrolled (starts folded) without it. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/**
 * What each color means: seats left after the standby list. Round 140 (John: "Just color and seat
 * availability. Let the user decide on the likelihood") dropped the chance words it used to explain.
 */
export const TIER_MEANING: Record<SeatTier, string> = {
  wide: '',
  good: '',
  okay: '',
  tight: '',
  full: '',
  unknown: 'no count yet',
};

/** Each line's color as a seat range, for the folded key's rows (round 137, numbers since round 140). */
export const TIER_SHORT: Record<SeatTier, string> = {
  wide: '50+ seats',
  good: '15 to 49 seats',
  okay: '6 to 14 seats',
  tight: '1 to 5 seats',
  full: 'No seats',
  unknown: 'No seat info',
};

/**
 * One folded row: what the color says and what the line style says, e.g. "15 to 49 seats, reported" or
 * "1 to 5 seats, estimated" (round 137, John: the key "just says Map Key with no other context").
 */
export function chipLine(entry: LegendEntry): string {
  if (entry.source === 'typical') return 'Typical day, estimated';
  if (entry.source === 'unknown') return 'No seat info yet';
  return `${TIER_SHORT[entry.tier]}, ${entry.dashed ? 'estimated' : 'reported'}`;
}

/** The map's marks, in plain words, in the order the key lists them. */
export const MARK_MEANING: { kind: MarkKind | 'badge-caution' | 'badge-likelyDelays'; text: string }[] = [
  { kind: 'origin', text: 'Where you leave from' },
  { kind: 'stop', text: 'Where you connect' },
  { kind: 'destination', text: "Where you're going" },
  { kind: 'home', text: 'Your home' },
  { kind: 'badge-caution', text: 'Weather to watch at that airport' },
  { kind: 'badge-likelyDelays', text: 'Delays likely at that airport' },
];

/** The marks rows for what's on the map now. */
export function markRows(marks: readonly MarkKind[] = [], badges: readonly AirportStatusLevel[] = []) {
  const has = new Set<string>([...marks.map((k) => (k === 'altHome' ? 'home' : k)), ...badges.map((b) => `badge-${b}`)]);
  return MARK_MEANING.filter((m) => has.has(m.kind));
}

/** What each line style means. */
const STYLE_MEANING = {
  solid: 'Solid line: seats someone reported',
  dashed: 'Dashed line: our estimate',
};

/** The seat circles on the route card, explained by example. */
export const SEAT_CIRCLE_EXAMPLE = '10/4';
export const SEAT_CIRCLE_MEANING = '10 seats left, 4 people listed';

/** The open key's rows, in order, for the card and for VoiceOver. */
export function keyRows(route: RouteLine) {
  const rows = legendEntries(route);
  // One color row per seat range on this route; typical loads and no data share the gray.
  const tiers: SeatTier[] = [];
  for (const r of rows) if (!tiers.includes(r.tier)) tiers.push(r.tier);
  const colors = tiers.map((tier) => {
    const typicalOnly = rows.every((r) => r.tier !== tier || r.source === 'typical');
    return {
      tier,
      label: typicalOnly ? 'Gray' : TIER_LABEL[tier],
      meaning: typicalOnly ? 'a typical day, no live count' : TIER_MEANING[tier],
    };
  });
  const lineStyles: ('solid' | 'dashed')[] = [];
  if (rows.some((r) => !r.dashed)) lineStyles.push('solid');
  if (rows.some((r) => r.dashed)) lineStyles.push('dashed');
  return { colors, lineStyles };
}

export function RouteLegend({ route, marks, badges, open: openProp, onToggle }: RouteLegendProps) {
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
        style={({ pressed }) => [boxStyle, styles.open, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={['Map key.', ...rows.map((row) => `${chipLine(row)}, ${row.dashed ? 'dashed' : 'solid'} line.`)].join(
          ' ',
        )}
        accessibilityHint="Opens the full key: line colors, line styles, the map's marks and seat circles"
        accessibilityState={{ expanded: false }}
        testID="route-legend">
        {/* Each line on the route with what it means, so the folded key reads on its own (round 137). */}
        {rows.map((row) => (
          <View key={row.key} style={styles.row} testID="legend-line">
            {swatch(row)}
            <Text style={[textStyle, styles.rowText]}>{chipLine(row)}</Text>
          </View>
        ))}
        <Text style={[textStyles.small, styles.more, { color: c.accent }]}>What the map shows ›</Text>
      </Pressable>
    );
  }

  // Opened, the key explains itself at a glance (round 126, John: "I'm not sure what it means as a new
  // user"): a title, what the color means, what the line style means, and how to read a seat circle.
  const key = keyRows(route);
  const marked = markRows(marks, badges);
  const heading = [textStyles.small, styles.heading, { color: c.muted }];
  const spoken = [
    'Map key.',
    'Line color is seats left after the list:',
    ...key.colors.map((r) => `${r.label}${r.meaning ? `, ${r.meaning}` : ''}.`),
    ...key.lineStyles.map((s) => `${STYLE_MEANING[s]}.`),
    ...marked.map((m) => `${m.text}.`),
    `On the route card, a seat circle like ${SEAT_CIRCLE_EXAMPLE} means ${SEAT_CIRCLE_MEANING}.`,
    `${CANCELED_MEANING}.`,
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
      <Text style={heading}>Line color is seats left after the list</Text>
      {key.colors.map((r) => (
        <View key={r.tier} style={styles.row} testID="legend-color">
          <SolidSwatch color={c[r.tier]} />
          <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.muted }]}>
            <Text style={[styles.strong, { color: c.text }]}>{r.label}</Text>
            {r.meaning ? `  ${r.meaning}` : ''}
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
      {marked.length ? <Text style={[heading, styles.section]}>On the map</Text> : null}
      {marked.map((m) => (
        <View key={m.kind} style={styles.row} testID="legend-mark">
          <View style={styles.markSlot}>
            <MarkSwatch kind={m.kind} />
          </View>
          <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.text }]}>{m.text}</Text>
        </View>
      ))}
      <Text style={[heading, styles.section]}>Seat circles on the route card</Text>
      <View style={styles.row} testID="legend-seats">
        <View style={[styles.seatDot, { borderColor: c.muted }]}>
          <Text style={[styles.seatDotText, { color: c.text }]}>{SEAT_CIRCLE_EXAMPLE}</Text>
        </View>
        <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.text }]}>{SEAT_CIRCLE_MEANING}</Text>
      </View>
      <View style={styles.row} testID="legend-canceled">
        <CanceledSwatch color={c.canceled} disc={c.surface} />
        <Text style={[textStyles.small, styles.label, styles.rowText, { color: c.text }]}>{CANCELED_MEANING}</Text>
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
  more: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, marginTop: 1 },
  markSlot: { width: 16, alignItems: 'center', justifyContent: 'center' },
  markDot: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5 },
  markRing: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.2 },
  markStop: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.6 },
  markDiamond: { width: 7, height: 7, transform: [{ rotate: '45deg' }] },
  markTriangle: { fontSize: 10, lineHeight: 12 },
  markHome: { width: 13, height: 13, borderRadius: 6.5, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  canceledSwatch: { width: SWATCH_W, height: 10, justifyContent: 'center' },
  xDisc: {
    position: 'absolute',
    left: SWATCH_W / 2 - 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xBar: { position: 'absolute', width: 5, height: 1.2, borderRadius: 1 },
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
