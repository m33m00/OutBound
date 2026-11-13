import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';

/**
 * Manrope for everything you read and every title (round 199, John: "Unique clean font too", then "Add
 * Manrope"): open-licensed, distinctive but very readable small, with tabular numbers for counts. It replaced
 * Geist (round 120). Geist Mono stays for times and flight numbers so digits line up row to row. Big
 * Shoulders stays only for the OUTBOUND wordmark. Alternates if John wants to swap: Plus Jakarta Sans, Figtree.
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
  GeistMono_500Medium,
  GeistMono_600SemiBold,
};

export const fonts = {
  /** The wordmark only. */
  brand: 'BigShouldersDisplay_700Bold',
  /** Titles, route names and big airport codes. */
  title: 'Manrope_700Bold',
  display: 'Manrope_700Bold',
  displaySemiBold: 'Manrope_600SemiBold',
  displayHeavy: 'Manrope_800ExtraBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  /** Big times. */
  mono: 'GeistMono_600SemiBold',
  /** Flight numbers and smaller times. */
  monoMedium: 'GeistMono_500Medium',
} as const satisfies Record<string, keyof typeof fontAssets>;
