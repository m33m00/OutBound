/**
 * Big Shoulders Display for map labels (and Manrope for leg time pills), loaded into Skia from the same
 * bundled font files the app uses (src/theme fontAssets). Skia draws text
 * with its own typefaces, so the expo-font copies cannot be reused directly;
 * `useTypeface` reads the bundled asset (works in Expo Go, no network).
 *
 * Returns null until both weights are loaded; the map draws marks without
 * labels for that moment.
 */
import { Skia, useTypeface, type SkFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { fontAssets, useBoldText } from '@/theme';

import { LEG_TIME_PILL } from './legTimes';
import { LABEL_FONT, type MarkKind } from './marks';

export type MarkFonts = Record<MarkKind, SkFont>;

export function useMarkFonts(): MarkFonts | null {
  const semi = useTypeface(fontAssets.BigShouldersDisplay_600SemiBold);
  const bold = useTypeface(fontAssets.BigShouldersDisplay_700Bold);
  const heavy = useTypeface(fontAssets.BigShouldersDisplay_800ExtraBold);
  // Bold Text (round 38): each label a weight heavier.
  const boldText = useBoldText();
  return useMemo(() => {
    if (!semi || !bold || !heavy) return null;
    const out = {} as MarkFonts;
    for (const kind of Object.keys(LABEL_FONT) as MarkKind[]) {
      const f = LABEL_FONT[kind];
      const face = f.weight === 700 ? (boldText ? heavy : bold) : boldText ? bold : semi;
      out[kind] = Skia.Font(face, f.size);
    }
    return out;
  }, [semi, bold, heavy, boldText]);
}

/**
 * Manrope 600 for leg flight-time pills (item 15, 12/16). Null until loaded;
 * the pills wait, nothing else does.
 */
export function useLegTimeFont(): SkFont | null {
  const semi = useTypeface(fontAssets.Manrope_600SemiBold);
  const bold = useTypeface(fontAssets.Manrope_700Bold);
  const boldText = useBoldText();
  return useMemo(() => {
    const face = boldText ? bold : semi;
    return face ? Skia.Font(face, LEG_TIME_PILL.fontSize) : null;
  }, [semi, bold, boldText]);
}
