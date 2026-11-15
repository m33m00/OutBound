import { Fragment, type ReactNode } from 'react';
import { Image, StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { forSpeech } from '@/search/format';
import { useColors } from '@/theme';

/**
 * The Jaunt plane and its level contrail, white on clear so it takes a tint (round 208, level since round 209;
 * design/assets/make-trail-mark.py). The picture is 46 by 16: the mark in the middle, clear space above and
 * below, so set inline on the baseline it sits level with the middle of the airport codes.
 */
const TRAIL_MARK = require('../../assets/images/trail-mark.png');
const ASPECT = 46 / 16;
/** How tall the picture is next to text of a given size: about a capital letter. */
const CAP = 0.72;

/** The arrow the app's route strings carry between codes ("DAL → PHX → LAX"). */
export const ROUTE_ARROW = ' → ';

/** "DAL to DEN to LAX" as "DAL → DEN → LAX", so a route stored in words shows the mark too. */
export const marketArrows = (text: string) => text.replace(/\b([A-Z]{3}) to (?=[A-Z]{3}\b)/g, `$1${ROUTE_ARROW}`);

/** The mark's size in points next to text of `fontSize`. */
export function trailMarkSize(fontSize: number) {
  const height = Math.round(fontSize * CAP);
  return { width: Math.round(height * ASPECT), height };
}

/** The plane and contrail on its own, in boarding blue unless `color` says otherwise. */
export function TrailMark({ fontSize, color }: { fontSize: number; color?: string }) {
  const c = useColors();
  return (
    <Image
      source={TRAIL_MARK}
      style={[trailMarkSize(fontSize), { tintColor: color ?? c.accent }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID="route-trail-mark"
    />
  );
}

/**
 * Route text with the plane and contrail where the arrow was, for use as a Text's children (round 209, John:
 * "Apply it everywhere for s market"). Text without an arrow comes back as the same string.
 */
export function trails(text: string, fontSize: number, color?: string): ReactNode {
  const parts = text.split(ROUTE_ARROW);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? (
        <>
          {' '}
          <TrailMark fontSize={fontSize} color={color} />{' '}
        </>
      ) : null}
      {part}
    </Fragment>
  ));
}

/**
 * A Text whose arrows show as the plane and contrail. VoiceOver still hears "DAL to LAX", since the mark is a
 * picture it skips.
 */
export function RouteText({
  text,
  style,
  markColor,
  accessibilityLabel,
  ...rest
}: Omit<TextProps, 'children'> & { text: string; style?: StyleProp<TextStyle>; markColor?: string }) {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 15;
  const marked = text.includes(ROUTE_ARROW);
  return (
    <Text style={style} accessibilityLabel={accessibilityLabel ?? (marked ? forSpeech(text) : undefined)} {...rest}>
      {trails(text, fontSize, markColor)}
    </Text>
  );
}
