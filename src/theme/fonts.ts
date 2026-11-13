import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';

/**
 * Sora for everything you read and every title (round 200, John picked it: "Unique clean font too", then
 * "Sora" after Manrope in round 199 looked almost the same as Geist). Open-licensed, wide and round, so the app
 * reads as its own. Geist Mono stays for times and flight numbers so digits line up row to row. Big Shoulders
 * stays only for the OUTBOUND wordmark.
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight` (a bare fontWeight falls back to the system font on iOS).
 */
export const fontAssets = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
};

export const fonts = {
  /** The wordmark only. */
  brand: 'BigShouldersDisplay_700Bold',
  /** Titles, route names and big airport codes. */
  title: 'Sora_700Bold',
  display: 'Sora_700Bold',
  displaySemiBold: 'Sora_600SemiBold',
  displayHeavy: 'Sora_800ExtraBold',
  body: 'Sora_400Regular',
  bodyMedium: 'Sora_500Medium',
  bodySemiBold: 'Sora_600SemiBold',
  bodyBold: 'Sora_700Bold',
  /** Big times. */
  mono: 'GeistMono_600SemiBold',
  /** Flight numbers and smaller times. */
  monoMedium: 'GeistMono_500Medium',
} as const satisfies Record<string, keyof typeof fontAssets>;
