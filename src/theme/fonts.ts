import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';

/**
 * The Boarding pass look (round 114, John picked C on 2026-11-02): Instrument Serif for titles,
 * DM Sans for everything you read, DM Mono for times and flight numbers so digits line up like a
 * printed pass. Big Shoulders stays only for the OUTBOUND wordmark.
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight` (a bare fontWeight falls back to the system font on iOS).
 */
export const fontAssets = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  InstrumentSerif_400Regular,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  DMMono_400Regular,
  DMMono_500Medium,
};

export const fonts = {
  /** The wordmark only. */
  brand: 'BigShouldersDisplay_700Bold',
  /** Titles and city names: one weight, the serif carries it. */
  serif: 'InstrumentSerif_400Regular',
  /** Airport codes and other big labels. */
  display: 'DMSans_700Bold',
  displaySemiBold: 'DMSans_600SemiBold',
  displayHeavy: 'DMSans_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  /** Times and flight numbers. */
  mono: 'DMMono_500Medium',
} as const satisfies Record<string, keyof typeof fontAssets>;
