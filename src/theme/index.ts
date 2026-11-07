import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { useAppearancePref } from './appearance';
import { colors, inkColors, type ColorScheme, type Palette } from './colors';

export { colors, inkColors, type ColorScheme, type ColorToken, type Palette } from './colors';
export {
  APPEARANCE_LABEL,
  APPEARANCE_PREFS,
  applyAppearance,
  DEFAULT_APPEARANCE,
  getAppearancePref,
  parseAppearance,
  useAppearancePref,
  type AppearancePref,
} from './appearance';
export { applyBoldText, boldTextOn, useBoldText } from './boldText';
export { fontAssets, fonts } from './fonts';
export { elevation } from './elevation';
export { minTapTarget, radius, spacing } from './spacing';
export { textStyles, type TypeStyle } from './typography';

/**
 * Light or dark for this draw: the Appearance choice in Settings, or the phone's setting
 * when that's System (the default, DECISIONS.md round 173).
 */
export function useColorSchemeName(): ColorScheme {
  const pref = useAppearancePref();
  const phone = useColorScheme();
  if (pref !== 'system') return pref;
  return phone === 'dark' ? 'dark' : 'light';
}

/** True inside the navy ink band: everything drawn there takes its colors from inkColors. */
export const InkContext = createContext(false);

export function useColors(): Palette {
  const scheme = useColorSchemeName();
  return useContext(InkContext) ? inkColors[scheme] : colors[scheme];
}
