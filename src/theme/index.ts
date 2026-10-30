import { useColorScheme } from 'react-native';

import { colors, type ColorScheme, type Palette } from './colors';

export { colors, type ColorScheme, type ColorToken, type Palette } from './colors';
export { applyBoldText, boldTextOn, useBoldText } from './boldText';
export { fontAssets, fonts } from './fonts';
export { minTapTarget, radius, spacing } from './spacing';
export { textStyles, type TypeStyle } from './typography';

/** The app follows the phone's light/dark setting (DECISIONS.md). */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useColors(): Palette {
  return colors[useColorSchemeName()];
}
