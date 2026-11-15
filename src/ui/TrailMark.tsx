import { Fragment, type ReactNode } from 'react';
import { Image, StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { forSpeech } from '@/search/format';
import { useColors } from '@/theme';

/**
 * The Jaunt plane and its level contrail, white on clear so it takes a tint (round 208, level since round 209,
 * shorter and raised in round 210; design/assets/make-trail-mark.py). The picture is 35 by 16 with the mark in its
 * top 11: iOS sets an inline picture a little below the baseline, so drawn at the top it lands on the middle of
 * the airport codes' capitals (round 210, John: "bring it up more and allign it center").
 */
const TRAIL_MARK = require('../../assets/images/trail-mark.png');
const ASPECT = 35 / 16;
/** Where the mark stands on its own, centred in its box: how far to move it down, as a share of its height. */
const ALONE_DROP = 2.5 / 16;
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

/**
 * The plane and contrail, in boarding blue unless `color` says otherwise. `alone` when it stands in a row of its
 * own rather than inside text, so it centres in its box.
 */
export function TrailMark({ fontSize, color, alone = false }: { fontSize: number; color?: string; alone?: boolean }) {
  const c = useColors();
  const size = trailMarkSize(fontSize);
  return (
    <Image
      source={TRAIL_MARK}
      style={[
        size,
        { tintColor: color ?? c.accent },
        alone && { transform: [{ translateY: Math.round(size.height * ALONE_DROP) }] },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID="route-trail-mark"
    />
  );
}

/** A no-break space and a word joiner: the line never breaks between a code and the mark. */
const HOLD = '\u00A0\u2060';
const HOLD_AFTER = '\u2060\u00A0';

/**
 * Route text with the plane and contrail where the arrow was, for use as a Text's children (round 209, John:
 * "Apply it everywhere for s market"). Code, mark, code stay on one line together (round 210, John: "The trail
 * wraps some of the markets"). Text without an arrow comes back as the same string.
 */
export function trails(text: string, fontSize: number, color?: string): ReactNode {
  const parts = text.split(ROUTE_ARROW);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? (
        <>
          {HOLD}
          <TrailMark fontSize={fontSize} color={color} />
          {HOLD_AFTER}
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
