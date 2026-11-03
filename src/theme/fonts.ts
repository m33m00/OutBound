import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

/**
 * The Departure board look (round 117, John switched from C to A on 2026-11-03): Big Shoulders
 * Display for titles and airport codes, tall and condensed like a split-flap board; JetBrains Mono
 * for times and flight numbers so digits line up row to row; Manrope for everything you read.
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight` (a bare fontWeight falls back to the system font on iOS).
 */
export const fontAssets = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};

export const fonts = {
  /** The wordmark. */
  brand: 'BigShouldersDisplay_700Bold',
  /** The board face: titles, route names and big airport codes. */
  board: 'BigShouldersDisplay_800ExtraBold',
  /** Smaller bold labels. */
  display: 'Manrope_700Bold',
  displaySemiBold: 'Manrope_600SemiBold',
  displayHeavy: 'Manrope_800ExtraBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  /** Times on the board. */
  mono: 'JetBrainsMono_700Bold',
  /** Flight numbers and smaller times. */
  monoMedium: 'JetBrainsMono_500Medium',
} as const satisfies Record<string, keyof typeof fontAssets>;
