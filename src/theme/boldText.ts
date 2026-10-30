import { fonts } from './fonts';
import { textStyles } from './typography';

/**
 * iOS Bold Text (Settings > Accessibility > Display & Text Size). Custom
 * fonts don't follow it on their own, because each weight is its own family,
 * so with it on every style steps up a weight: regular and medium to
 * semibold or bold, the display face to its heavier cut (design round 38).
 * Applied once before the first screen draws, and again if the setting
 * changes (screens pick it up as they redraw).
 */
const HEAVIER: Record<string, string> = {
  Manrope_400Regular: 'Manrope_600SemiBold',
  Manrope_500Medium: 'Manrope_700Bold',
  Manrope_600SemiBold: 'Manrope_700Bold',
  Manrope_700Bold: 'Manrope_700Bold',
  BigShouldersDisplay_600SemiBold: 'BigShouldersDisplay_700Bold',
  BigShouldersDisplay_700Bold: 'BigShouldersDisplay_800ExtraBold',
  BigShouldersDisplay_800ExtraBold: 'BigShouldersDisplay_800ExtraBold',
};

/** The family to draw with when Bold Text is on. */
export const heavierFont = (family: string): string => HEAVIER[family] ?? family;

// The weights as designed, so Bold Text can be turned off again.
const baseFonts = { ...fonts };
const baseText = Object.fromEntries(Object.entries(textStyles).map(([k, s]) => [k, s.fontFamily])) as Record<
  keyof typeof textStyles,
  string
>;

let boldOn = false;
export const boldTextOn = () => boldOn;

/** Step every font and text style up a weight (on) or back to the design (off). */
export function applyBoldText(on: boolean): void {
  boldOn = on;
  const f = fonts as Record<keyof typeof fonts, string>;
  for (const k of Object.keys(baseFonts) as (keyof typeof fonts)[]) {
    f[k] = on ? heavierFont(baseFonts[k]) : baseFonts[k];
  }
  const t = textStyles as Record<keyof typeof textStyles, { fontFamily: string }>;
  for (const k of Object.keys(baseText) as (keyof typeof textStyles)[]) {
    t[k].fontFamily = on ? heavierFont(baseText[k]) : baseText[k];
  }
}
