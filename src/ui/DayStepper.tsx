import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DateChip } from '@/search/dates';
import { minTapTarget, radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { pressStyle } from './press';
import { withTick } from './haptics';

/** The days either side of `date` within the 0-7 day window; null at the ends. */
export function neighborDays(days: DateChip[], date: string): { prev: DateChip | null; next: DateChip | null } {
  const i = days.findIndex((d) => d.date === date);
  if (i < 0) return { prev: null, next: null };
  return { prev: days[i - 1] ?? null, next: days[i + 1] ?? null };
}

/**
 * "‹ Wed, Oct 30 ›" on the results header (Q-057): step a day without going
 * back to search. Arrows dim at the ends of the 0-7 day window.
 */
export function DayStepper({
  days,
  date,
  label,
  onDay,
}: {
  days: DateChip[];
  date: string;
  /** What the middle shows, e.g. "Wed, Oct 30". */
  label: string;
  onDay: (date: string) => void;
}) {
  const c = useColors();
  const { prev, next } = neighborDays(days, date);
  const current = days.find((d) => d.date === date);
  const arrow = (to: DateChip | null, dir: 'prev' | 'next') => (
    <Pressable
      testID={`day-${dir}`}
      onPress={to ? withTick(() => onDay(to.date)) : undefined}
      disabled={!to}
      accessibilityRole="button"
      accessibilityLabel={`${dir === 'prev' ? 'Previous day' : 'Next day'}${to ? `, ${to.long}` : ''}`}
      accessibilityState={{ disabled: !to }}
      style={pressStyle([styles.arrow, { opacity: to ? 1 : 0.35 }])}>
      <Icon
        name={dir === 'prev' ? 'chevron.left' : 'chevron.right'}
        size={16}
        weight="semibold"
        tintColor={c.accent}
        fallback={<Text style={[textStyles.heading, { color: c.accent }]}>{dir === 'prev' ? '‹' : '›'}</Text>}
      />
    </Pressable>
  );
  return (
    <View style={[styles.box, { backgroundColor: c.surface2 }]}>
      {arrow(prev, 'prev')}
      <Text
        style={[textStyles.bodyStrong, styles.label, { color: c.text }]}
        accessibilityLabel={current?.long ?? label}
        numberOfLines={1}>
        {label}
      </Text>
      {arrow(next, 'next')}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, flexShrink: 1 },
  arrow: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, textAlign: 'center' },
});
