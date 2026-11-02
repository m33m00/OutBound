import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

/**
 * Type scale for the Boarding pass look (round 114, John picked C on 2026-11-02). Three voices:
 * a serif for titles (Instrument Serif, one weight, sized up because it runs small), DM Sans for
 * reading, DM Mono for times so digits line up row to row. Sizes stay where round 112 had them
 * (body 14, heading 16): John found round 113's bigger, bolder text heavy.
 */
export const textStyles = {
  /** Screen and sheet titles: the serif. */
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  /** A route's name in a bar ("DFW → LGA"): the serif, smaller. */
  routeTitle: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
  },
  /** An airport code shown big, as on a boarding pass. */
  code: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  /** Big numbers: times, seat counts. */
  number: {
    fontFamily: fonts.mono,
    fontSize: 20,
    lineHeight: 26,
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
  /** A small label above a value ("ARRIVES"), tracked out like print. */
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof textStyles;
