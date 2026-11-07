import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DateChip } from '@/search/dates';
import { fonts, minTapTarget, radius, textStyles, useColors } from '@/theme';

import { pressStyle } from './press';
import { withTick } from './haptics';

/** The days either side of `date` within the 0-7 day window; null at the ends. */
export function neighborDays(days: DateChip[], date: string): { prev: DateChip | null; next: DateChip | null } {
  const i = days.findIndex((d) => d.date === date);
  if (i < 0) return { prev: null, next: null };
  return { prev: days[i - 1] ?? null, next: days[i + 1] ?? null };
}

/**
 * The results header's day picker (Q-057). Round 177, John: "It's not obvious that you can switch
 * days or that's what it means." So it says what it is ("Departing Tue, Oct 20", the route count
 * beside it) over a row of day buttons for the whole 0-7 day window, the searched day filled blue and
 * the rest light blue. The row scrolls to keep the
 * picked day in view.
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
  /** The searched day, e.g. "Tue, Oct 20". */
  label: string;
  onDay: (date: string) => void;
  /** The route count, e.g. "8 routes, 1 full". */
  detail?: string;
}) {
  const c = useColors();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Record<string, number>>({});
  useEffect(() => {
    const x = xs.current[date];
    if (x != null) scroll.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [date]);
  return (
    <View style={styles.box} testID="day-picker">
      <View style={styles.head}>
        <Text
          style={[textStyles.bodyStrong, styles.title, { color: c.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          testID="day-title">
          {`Departing ${label}`}
        </Text>
        {detail ? (
          <Text style={[textStyles.small, { color: c.muted }]} numberOfLines={1} testID="day-detail">
            {detail}
          </Text>
        ) : null}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel="Departure day">
        {days.map((d) => {
          const on = d.date === date;
          return (
            <Pressable
              key={d.date}
              testID={`day-${d.date}`}
              onLayout={(e) => {
                xs.current[d.date] = e.nativeEvent.layout.x;
              }}
              onPress={on ? undefined : withTick(() => onDay(d.date))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={[d.long, on ? detail : null].filter(Boolean).join(', ')}
              accessibilityHint={on ? undefined : 'Searches this day'}
              style={pressStyle([styles.chip, { backgroundColor: on ? c.accent : c.accentSoft }])}>
              <Text style={[styles.chipTop, { color: on ? c.onAccent : c.accent }]} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={[textStyles.small, { color: on ? c.onAccent : c.accent }]} numberOfLines={1}>
                {d.day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1 },
  row: { gap: 8 },
  chip: {
    minWidth: 68,
    minHeight: minTapTarget + 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTop: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 18 },
});
