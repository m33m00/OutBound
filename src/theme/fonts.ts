import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
} from '@expo-google-fonts/geist';
import { GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';

/**
 * The Clean look (round 120, John switched to look B on 2026-11-03): Geist for everything you read
 * and every title, tight and calm; Geist Mono for times and flight numbers so digits line up row to
 * row. Big Shoulders stays only for the OUTBOUND wordmark.
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight` (a bare fontWeight falls back to the system font on iOS).
 */
export const fontAssets = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
};

export const fonts = {
  /** The wordmark only. */
  brand: 'BigShouldersDisplay_700Bold',
  /** Titles, route names and big airport codes. */
  title: 'Geist_700Bold',
  display: 'Geist_700Bold',
  displaySemiBold: 'Geist_600SemiBold',
  displayHeavy: 'Geist_800ExtraBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemiBold: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',
  /** Big times. */
  mono: 'GeistMono_600SemiBold',
  /** Flight numbers and smaller times. */
  monoMedium: 'GeistMono_500Medium',
} as const satisfies Record<string, keyof typeof fontAssets>;
