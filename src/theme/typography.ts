import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

/**
 * Type scale for the Departure board look (round 117, John switched to A on 2026-11-03). Three
 * voices: Big Shoulders Display for titles and airport codes, upper case like a split-flap board;
 * JetBrains Mono for times so digits line up row to row; Manrope for reading. Reading sizes stay
 * where round 112 had them (body 14, heading 16).
 */
export const textStyles = {
  /** Screen and sheet titles: the board face, upper case. */
  title: {
    fontFamily: fonts.board,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** A route's name in a bar ("DFW → LGA"): the board face, smaller. */
  routeTitle: {
    fontFamily: fonts.board,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** An airport code shown big, as on a departures board. */
  code: {
    fontFamily: fonts.board,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  /** Big numbers: times, seat counts. */
  number: {
    fontFamily: fonts.mono,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  small: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** A small label above a value ("ARRIVES"), tracked out like a board header. */
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof textStyles;
