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
 * back to search. Arrows dim at the ends of the 0-7 day window. Spans the
 * panel's full width, arrows at the edges and the day centered (John, 2026-10-30).
 */
export function DayStepper({
  days,
  date,
  label,
  onDay,
  detail,
}: {
  days: DateChip[];
  date: string;
  /** What the middle shows, e.g. "Wed, Oct 30". */
  label: string;
  onDay: (date: string) => void;
  /** Small line under the day, e.g. "8 routes, 1 full". */
  detail?: string;
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
      <View
        style={styles.middle}
        accessible
        accessibilityLabel={[current?.long ?? label, detail].filter(Boolean).join(', ')}>
        <Text style={[textStyles.heading, styles.label, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={[textStyles.small, styles.label, { color: c.muted }]} numberOfLines={1} testID="day-detail">
            {detail}
          </Text>
        ) : null}
      </View>
      {arrow(next, 'next')}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, alignSelf: 'stretch' },
  arrow: { width: minTapTarget, minHeight: minTapTarget, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  label: { textAlign: 'center' },
});
