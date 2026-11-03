import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/** What the app's text uses between items; never shown (round 123, John: no dots between text). */
export const META_SEP = ' · ';

/** An em space: the gap that stands in for a dot inside one run of text. */
export const META_GAP = '\u2003';

/**
 * For text that has to stay one run (mixed colors inline, a button label): the dots become a
 * wide space, so "Departed · Los Angeles" shows as "Departed  Los Angeles" (round 123, John).
 */
export function spaced(text: string): string {
  return text.split(META_SEP).join(META_GAP);
}

/** Splits "1 stop · 11h 5m" into its items. */
export function metaParts(text: string): string[] {
  return text
    .split(META_SEP)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * A line of small facts set apart by space instead of dots (round 123, John: "Stop using bullet
 * points to separate text", meaning the · dots). Each item is its own text, so a long line wraps
 * between items, never inside one. Takes "a · b · c" text or ready items.
 */
export function MetaLine({
  text,
  parts,
  style,
  textStyle,
  lead,
  gap = 12,
  testID,
  numberOfLines,
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
}) {
  const items = (parts ? parts.filter((p): p is string => !!p) : []).flatMap(metaParts);
  if (!parts && text) items.push(...metaParts(text));
  if (!items.length && !lead) return null;
  return (
    <View style={[styles.row, { columnGap: gap }, style]} testID={testID}>
      {lead}
      {items.map((item, i) => (
        <Text key={i} lineBreakStrategyIOS="push-out" style={[styles.item, textStyle]} numberOfLines={numberOfLines}>
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 2, flexShrink: 1, minWidth: 0 },
  item: { flexShrink: 1 },
});
