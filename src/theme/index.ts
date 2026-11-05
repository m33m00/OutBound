import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { colors, inkColors, type ColorScheme, type Palette } from './colors';

export { colors, inkColors, type ColorScheme, type ColorToken, type Palette } from './colors';
export { applyBoldText, boldTextOn, useBoldText } from './boldText';
export { fontAssets, fonts } from './fonts';
export { elevation } from './elevation';
export { minTapTarget, radius, spacing } from './spacing';
export { textStyles, type TypeStyle } from './typography';

/** The app follows the phone's light/dark setting (DECISIONS.md). */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** True inside the navy ink band: everything drawn there takes its colors from inkColors. */
export const InkContext = createContext(false);

export function useColors(): Palette {
  const scheme = useColorSchemeName();
  return useContext(InkContext) ? inkColors[scheme] : colors[scheme];
}
