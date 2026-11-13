import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

/**
 * Type scale for the Clean look (round 120, John switched to look B on 2026-11-03), closest to
 * Flighty: Sora throughout since round 200 (Geist before), bold and tightly tracked for titles, Geist
 * Mono for times so digits line up row to row. Reading sizes stay where round 112 had them (body 14, heading 16).
 */
export const textStyles = {
  /** Screen and sheet titles. */
  title: {
    fontFamily: fonts.title,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
  },
  /** A route's name in a bar ("DFW → LGA"). */
  routeTitle: {
    fontFamily: fonts.title,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
  },
  /** An airport code shown big. */
  code: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  /** Big numbers: times, seat counts. */
  number: {
    fontFamily: fonts.mono,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.6,
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
  /** A small label beside or above a value ("Arrives"): quiet, sentence case. */
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof textStyles;
