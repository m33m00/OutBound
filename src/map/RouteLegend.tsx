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
 * Folded to a small "Key" chip until tapped (John, 2026-11-03: the open card
 * covered a third of a squished map). The chip shows one swatch per line so it
 * still hints at the colors; tapping opens the full list, tapping again folds it.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyles, useColors } from '@/theme';

import { hexToRgb, rgba } from './globeColors';
import { DASH_PATTERN, legendEntries } from './routeModel';
import type { RouteLine } from './types';

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
  const boxStyle = [styles.box, { backgroundColor: rgba(hexToRgb(c.surface), 0.92), borderColor: c.line }];
  const swatch = (row: (typeof rows)[number]) =>
    row.dashed ? <DashedSwatch color={c[row.tier]} /> : <SolidSwatch color={c[row.tier]} />;

  if (!open) {
    return (
      <Pressable
        onPress={toggle}
        hitSlop={8}
        style={({ pressed }) => [boxStyle, styles.chip, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Line key"
        accessibilityHint="Shows what each line style means"
        accessibilityState={{ expanded: false }}
        testID="route-legend">
        <View style={styles.chipSwatches}>
          {rows.map((row) => (
            <View key={row.key}>{swatch(row)}</View>
          ))}
        </View>
        <Text style={textStyle}>Key</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [boxStyle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Line key. ${rows.map((r) => r.accessibilityLabel).join('. ')}`}
      accessibilityHint="Folds the key"
      accessibilityState={{ expanded: true }}
      testID="route-legend">
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          {swatch(row)}
          <Text style={textStyle}>{row.label}</Text>
        </View>
      ))}
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
