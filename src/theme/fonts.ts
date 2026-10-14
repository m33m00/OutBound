import {
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
} from '@expo-google-fonts/big-shoulders-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';

/**
 * Big Shoulders Display (uppercase display) + Manrope (body), per DECISIONS.md.
 * Weights confirmed in DECISIONS.md (Q-005).
 *
 * In React Native each weight is its own family name, so pick a family
 * instead of setting `fontWeight`.
 */
export const fontAssets = {
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
};

export const fonts = {
  display: 'BigShouldersDisplay_700Bold',
  displaySemiBold: 'BigShouldersDisplay_600SemiBold',
  displayHeavy: 'BigShouldersDisplay_800ExtraBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const satisfies Record<string, keyof typeof fontAssets>;
