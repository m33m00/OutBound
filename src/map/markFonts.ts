/**
 * Manrope for map labels (round 199; Geist before) and Geist Mono for leg time pills (round 120, the Clean look), loaded into Skia from the same
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
  const semi = useTypeface(fontAssets.Manrope_600SemiBold);
  const bold = useTypeface(fontAssets.Manrope_700Bold);
  const heavy = useTypeface(fontAssets.Manrope_800ExtraBold);
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
 * Geist Mono for leg flight-time pills (item 15, 12/16). Null until loaded;
 * the pills wait, nothing else does.
 */
export function useLegTimeFont(): SkFont | null {
  // Medium normally, bold with Bold Text.
  const semi = useTypeface(fontAssets.GeistMono_500Medium);
  const bold = useTypeface(fontAssets.GeistMono_600SemiBold);
  const boldText = useBoldText();
  return useMemo(() => {
    const face = boldText ? bold : semi;
    return face ? Skia.Font(face, LEG_TIME_PILL.fontSize) : null;
  }, [semi, bold, boldText]);
}
