import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

/**
 * Type scale (round 113, John 2026-11-02: premium, clean, not over the top). One family, Inter,
 * in a short scale: title 28, number 22, heading 17, button 15, body 15, small 12. Big sizes get
 * a little negative tracking, as Inter is drawn for; times use tabular figures so digits line up
 * and don't jiggle as they change. The wordmark keeps the brand face.
 */
export const textStyles = {
  /** Screen and sheet titles, and a picked airport's code. */
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  /** Big numbers: times, seat counts. */
  number: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  /** Wordmark in the top bar: the brand face, wide tracking. */
  wordmark: {
    fontFamily: fonts.brand,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 2.72,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  bodyStrong: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  /** Buttons use Title Case copy (Find Routes, Get Home). */
  button: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  small: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof textStyles;
