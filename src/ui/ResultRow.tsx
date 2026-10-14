import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Itinerary, SeatTier } from '@/engine';
import type { RouteImpact } from '@/live';
import { formatDuration, nearbyNotes, rowAccessibilityLabel, rowTimes, seatText, stopsText } from '@/search/format';
import { impactSummary } from '@/search/impactText';
import { radius, spacing, textStyles, useColors, type ColorToken } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { ImpactBadge } from './ImpactBadge';

/** Tier text and fill tokens; color is never the only signal (word + number). */
const TIER_FG: Record<SeatTier, ColorToken> = {
  wide: 'wideFg',
  good: 'goodFg',
  okay: 'okayFg',
  tight: 'tightFg',
  full: 'fullFg',
  unknown: 'unknownFg',
};
const TIER_BG: Record<SeatTier, ColorToken> = {
  wide: 'wideBg',
  good: 'goodBg',
  okay: 'okayBg',
  tight: 'tightBg',
  full: 'fullBg',
  unknown: 'unknownBg',
};

export interface ResultRowProps {
  itinerary: Itinerary;
  selected: boolean;
  now: number;
  onPress: (id: string) => void;
  /** Delay/weather impact (Q-001, item 7); undefined while not available. */
  impact?: RouteImpact;
  /** Live data still loading for the first time. */
  impactLoading?: boolean;
  onImpactPress?: (id: string) => void;
}

export const ResultRow = memo(function ResultRow({
  itinerary: it,
  selected,
  now,
  onPress,
  impact,
  impactLoading,
  onImpactPress,
}: ResultRowProps) {
  const c = useColors();
  const t = rowTimes(it);
  const hasImpact = impact != null && impact.level !== 'none';
  const label = [rowAccessibilityLabel(it, now), hasImpact ? impactSummary(impact, now) : ''].filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={() => onPress(it.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityActions={hasImpact ? [{ name: 'impact', label: 'Delay and weather details' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'impact') onImpactPress?.(it.id);
      }}
      accessibilityHint={selected ? 'Tap to clear the route from the globe' : 'Shows this route on the globe'}
      style={[
        styles.row,
        {
          // Full routes stay in time order, grayed with a red edge; text keeps full contrast.
          backgroundColor: selected ? c.accentSoft : it.isFull ? c.surface2 : c.surface,
          borderColor: selected ? c.accent : it.isFull ? c.full : c.line,
        },
        (selected || it.isFull) && styles.strongBorder,
      ]}>
      {/* Route color = weakest leg. */}
      <View style={[styles.edge, { backgroundColor: c[it.tier] }]} />
      <View style={styles.content}>
        <View style={styles.line}>
          <Text style={[textStyles.number, { color: c.text }]}>
            {t.depart} – {t.arrive}
            {t.plusDays ? <Text style={[textStyles.small, { color: c.muted }]}> {t.plusDays}</Text> : null}
          </Text>
          <View style={styles.badgeSlot} testID="badge-slot">
            {hasImpact ? (
              <ImpactBadge impact={impact} now={now} onPress={() => onImpactPress?.(it.id)} />
            ) : impactLoading ? (
              <Text style={[textStyles.small, { color: c.faint }]}>Checking…</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.line}>
          <Text style={[textStyles.bodyStrong, { color: c.text }]}>
            {[it.origin, ...it.legs.map((l) => l.flight.to)].join(' → ')}
          </Text>
          <Text style={[textStyles.body, { color: c.muted }]}>
            {stopsText(it)} · {formatDuration(it.totalMin)}
          </Text>
        </View>
        {it.legs.map((leg) => (
          <View key={leg.flight.id} style={styles.legLine}>
            <AirlinePill airline={leg.flight.airline} flightNumber={leg.flight.flightNumber} />
            <View
              style={[
                styles.tierChip,
                { backgroundColor: leg.seats.source === 'typical' ? c.surface2 : c[TIER_BG[leg.seats.tier]] },
              ]}>
              <Text
                style={[
                  textStyles.small,
                  { color: leg.seats.source === 'typical' ? c.muted : c[TIER_FG[leg.seats.tier]] },
                ]}>
                {seatText(leg.seats, now)}
              </Text>
            </View>
          </View>
        ))}
        {nearbyNotes(it).map((note) => (
          <Text key={note} style={[textStyles.small, { color: c.muted }]}>
            {note}
          </Text>
        ))}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 44,
  },
  strongBorder: {
    borderWidth: 2,
  },
  edge: {
    width: 5,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.rowY,
    paddingHorizontal: spacing.rowX,
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.group,
  },
  badgeSlot: {
    flexShrink: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 20,
  },
  legLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    flexWrap: 'wrap',
  },
  tierChip: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
});
