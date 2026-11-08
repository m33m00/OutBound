import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DateChip } from '@/search/dates';
import { fonts, minTapTarget, radius, textStyles, useColors } from '@/theme';

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
 * The results header's day picker (Q-057). Round 177, John: "It's not obvious that you can switch
 * days or that's what it means." So it says what it is ("Departing Tue, Oct 20", the route count
 * beside it) over a row of day buttons for the whole 0-7 day window, the searched day filled blue and
 * the rest light blue. The row scrolls to keep the
 * picked day in view.
 *
 * Round 179, John: "not obvious to scroll left and right ... add arrows but keep the buttons". A round
 * arrow button sits at each end of the row and steps to the day before or after (searching it, like a
 * tap on that day), so paging reads at a glance; each dims at the end of the window.
 *
 * Round 180, John: "Why do the arrows overlap with a date? That doesn't look good." The row cut a day
 * button in half at its edge, next to the arrow. Now the row only ever shows whole buttons: it measures
 * the space between the arrows, fits as many buttons as there's room for (at least DAY_MIN wide each),
 * sizes them to fill it exactly, and snaps a whole button at a time when swiped.
 */
export const DAY_GAP = 8;
export const DAY_MIN = 80;

/** How many whole day buttons fit in `width`, and how wide each is so they fill it exactly. */
export function fitDays(width: number, count: number): { n: number; w: number } | null {
  if (!(width > 0) || count < 1) return null;
  const n = Math.max(1, Math.min(count, Math.floor((width + DAY_GAP) / (DAY_MIN + DAY_GAP))));
  return { n, w: (width - DAY_GAP * (n - 1)) / n };
}

/** The first shown button after picking day `i`: unchanged if `i` is already in view, else just enough to show it. */
export function windowStart(start: number, i: number, n: number, count: number): number {
  let s = start;
  if (i < s) s = i;
  else if (i > s + n - 1) s = i - n + 1;
  return Math.max(0, Math.min(s, count - n));
}
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
  const [width, setWidth] = useState(0);
  const fit = fitDays(width, days.length);
  const start = useRef<number | null>(null);
  const index = days.findIndex((d) => d.date === date);
  const step = fit ? fit.w + DAY_GAP : 0;
  useEffect(() => {
    if (!fit || index < 0) return;
    const first = start.current == null;
    const s = windowStart(first ? index : start.current!, index, fit.n, days.length);
    start.current = s;
    scroll.current?.scrollTo({ x: s * step, animated: !first });
  }, [index, fit?.n, step, days.length]);
  const { prev, next } = neighborDays(days, date);
  const arrow = (to: DateChip | null, dir: 'prev' | 'next') => (
    <Pressable
      testID={`day-${dir}`}
      onPress={to ? withTick(() => onDay(to.date)) : undefined}
      disabled={!to}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${dir === 'prev' ? 'Previous day' : 'Next day'}${to ? `, ${to.long}` : ''}`}
      accessibilityState={{ disabled: !to }}
      style={pressStyle([styles.arrow, { backgroundColor: c.accentSoft, opacity: to ? 1 : 0.35 }])}>
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
      <View style={styles.strip}>
        {arrow(prev, 'prev')}
        <ScrollView
          ref={scroll}
          style={styles.scroll}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          snapToInterval={step || undefined}
          decelerationRate={step ? 'fast' : undefined}
          disableIntervalMomentum
          onMomentumScrollEnd={(e) => {
            if (step) start.current = Math.round(e.nativeEvent.contentOffset.x / step);
          }}
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
                onPress={on ? undefined : withTick(() => onDay(d.date))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={[d.long, on ? detail : null].filter(Boolean).join(', ')}
                accessibilityHint={on ? undefined : 'Searches this day'}
                style={pressStyle([
                  styles.chip,
                  fit ? { width: fit.w, minWidth: 0 } : null,
                  { backgroundColor: on ? c.accent : c.accentSoft },
                ])}>
                <Text
                  style={[styles.chipTop, { color: on ? c.onAccent : c.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}>
                  {d.label}
                </Text>
                <Text style={[textStyles.small, { color: on ? c.onAccent : c.accent }]} numberOfLines={1}>
                  {d.day}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {arrow(next, 'next')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scroll: { flex: 1 },
  row: { gap: DAY_GAP },
  arrow: {
    width: 36,
    height: minTapTarget + 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minWidth: DAY_MIN,
    minHeight: minTapTarget + 8,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTop: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 18 },
});
