import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { fonts, useColors } from '@/theme';

/** What the app's text uses between items; never shown (round 123, John: no dots between text). */
export const META_SEP = ' · ';

/** The inline divider: a thin bar with a little space each side (round 124, John: "Needs dividers"). */
export const INLINE_DIVIDER = '\u2002|\u2002';

/**
 * For text that has to stay one run (mixed colors inline): each dot becomes a thin, faint bar, so
 * "Departed · Los Angeles" shows as "Departed | Los Angeles" with the bar in the line color.
 * Use inside a Text.
 */
export function Divided({ text, color }: { text: string; color?: string }) {
  const c = useColors();
  const parts = text.split(META_SEP);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <Text style={{ color: color ?? c.line2, fontFamily: fonts.body }} testID="inline-divider">
              {INLINE_DIVIDER}
            </Text>
          ) : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/** Splits "1 stop · 11h 5m" into its items. */
export function metaParts(text: string): string[] {
  return text
    .split(META_SEP)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * A line of small facts set apart by thin vertical dividers instead of dots (round 123, John: "Stop
 * using bullet points to separate text"; round 124: "Needs dividers"). Each item is its own text, so
 * a long line wraps between items, never inside one. Takes "a · b · c" text or ready items.
 */
export function MetaLine({
  text,
  parts,
  style,
  textStyle,
  lead,
  gap = 8,
  testID,
  numberOfLines,
  dividerColor,
}: {
  text?: string | null;
  parts?: readonly (string | null | undefined | false)[];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** Something drawn before the first item, like a colored dot. */
  lead?: ReactNode;
  gap?: number;
  testID?: string;
  numberOfLines?: number;
  /** The divider's color; the soft line color by default. */
  dividerColor?: string;
}) {
  const c = useColors();
  const items = (parts ? parts.filter((p): p is string => !!p) : []).flatMap(metaParts);
  if (!parts && text) items.push(...metaParts(text));
  if (!items.length && !lead) return null;
  return (
    <View style={[styles.row, { columnGap: gap }, style]} testID={testID}>
      {lead}
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 || lead ? (
            <View style={[styles.divider, { backgroundColor: dividerColor ?? c.line2 }]} testID="meta-divider" />
          ) : null}
          <Text lineBreakStrategyIOS="push-out" style={[styles.item, textStyle]} numberOfLines={numberOfLines}>
            {item}
          </Text>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 2, flexShrink: 1, minWidth: 0 },
  item: { flexShrink: 1 },
  // A thin bar about cap height, soft in light and dark.
  divider: { width: 1, height: 12, borderRadius: 0.5 },
});
