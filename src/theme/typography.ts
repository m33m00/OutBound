import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

/**
 * Type scale, confirmed in DECISIONS.md (Q-004; from the Ice Mix prototype).
 * Display styles are always uppercase (Big Shoulders rule in DECISIONS.md).
 */
export const textStyles = {
  /** Screen titles. Prototype Ice Mix h2: 29px, uppercase, .02em tracking. */
  title: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: 0.58,
    textTransform: 'uppercase',
  },
  /** Big numbers: times, seat counts. Prototype uses weight 800. */
  number: {
    fontFamily: fonts.displayHeavy,
    fontSize: 22,
    lineHeight: 26,
  },
  /** Wordmark in the top bar. Prototype .brand b: 17px, 700, .16em tracking. */
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 2.72,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyStrong: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Buttons use Title Case copy (Find Routes, Get Home). */
  button: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  small: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof textStyles;
