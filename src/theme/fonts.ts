import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

/**
 * Inter for everything you read (John, 2026-11-02: the app should feel premium, not bare-bones):
 * one clean family with tabular figures for times, like the best flight apps. Big Shoulders stays
 * only for the OUTBOUND wordmark, as the brand mark.
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight`.
 */
export const fontAssets = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

export const fonts = {
  /** The wordmark only. */
  brand: 'BigShouldersDisplay_700Bold',
  display: 'Inter_700Bold',
  displaySemiBold: 'Inter_600SemiBold',
  displayHeavy: 'Inter_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const satisfies Record<string, keyof typeof fontAssets>;
