import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Itinerary, SeatTier } from '@/engine';
import { formatDuration, nearbyNotes, rowAccessibilityLabel, rowTimes, seatText, stopsText } from '@/search/format';
import { radius, spacing, textStyles, useColors, type ColorToken } from '@/theme';

import { AirlinePill } from './AirlinePill';

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
  /** Delay/weather badges (Q-001), filled in backlog item 7. */
  badges?: ReactNode;
}

export const ResultRow = memo(function ResultRow({ itinerary: it, selected, now, onPress, badges }: ResultRowProps) {
  const c = useColors();
  const t = rowTimes(it);
  return (
    <Pressable
      onPress={() => onPress(it.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={rowAccessibilityLabel(it, now)}
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
            {badges}
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
