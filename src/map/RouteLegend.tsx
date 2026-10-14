/**
 * Line legend, shown only while a route is selected (DECISIONS.md "Map").
 * Tier swatches are line fills (allowed); all text is in the `text` token,
 * never tier-colored. No weather key (removed in DECISIONS.md).
 *
 * GlobeMap places it bottom-left inside its insets (away from map buttons on
 * the right). Screens can pass `showLegend={false}` and place this instead.
 */
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, textStyles, useColors } from '@/theme';

import { hexToRgb, rgba } from './globeColors';
import { DASH_PATTERN, legendEntries, TIER_LABEL } from './routeModel';
import type { RouteLine } from './types';

const SWATCH_W = 22;
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
        <View
          key={i}
          style={{ width: on, height: SWATCH_H, borderRadius: 1.5, backgroundColor: color, marginRight: off }}
        />
      ))}
    </View>
  );
}

export interface RouteLegendProps {
  route: RouteLine;
}

export function RouteLegend({ route }: RouteLegendProps) {
  const c = useColors();
  const { tiers, hasSolid, hasDashed, unknownDashed } = legendEntries(route);
  const textStyle = [textStyles.small, { color: c.text }];
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: rgba(hexToRgb(c.surface), 0.92), borderColor: c.line },
      ]}
      accessible
      accessibilityLabel={`Legend: ${tiers.map((t) => TIER_LABEL[t]).join(', ')}. ${
        hasSolid ? 'Solid line, reported. ' : ''
      }${hasDashed ? 'Dashed line, estimate or no report.' : ''}`.trim()}>
      {tiers.map((t) => (
        <View key={t} style={styles.row}>
          {t === 'unknown' && unknownDashed ? (
            <DashedSwatch color={c[t]} />
          ) : (
            <SolidSwatch color={c[t]} />
          )}
          <Text style={textStyle}>{TIER_LABEL[t]}</Text>
        </View>
      ))}
      {tiers.length > 0 && (hasSolid || hasDashed) ? (
        <View style={[styles.rule, { backgroundColor: c.line }]} />
      ) : null}
      {hasSolid ? (
        <View style={styles.row}>
          <SolidSwatch color={c.muted} />
          <Text style={textStyle}>Reported</Text>
        </View>
      ) : null}
      {hasDashed ? (
        <View style={styles.row}>
          <DashedSwatch color={c.muted} />
          <Text style={textStyle}>Estimate or no report</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: spacing.group,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
  },
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
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
});
