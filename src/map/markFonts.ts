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

import { fontAssets } from '@/theme';

import { LEG_TIME_PILL } from './legTimes';
import { LABEL_FONT, type MarkKind } from './marks';

export type MarkFonts = Record<MarkKind, SkFont>;

export function useMarkFonts(): MarkFonts | null {
  const semi = useTypeface(fontAssets.BigShouldersDisplay_600SemiBold);
  const bold = useTypeface(fontAssets.BigShouldersDisplay_700Bold);
  return useMemo(() => {
    if (!semi || !bold) return null;
    const out = {} as MarkFonts;
    for (const kind of Object.keys(LABEL_FONT) as MarkKind[]) {
      const f = LABEL_FONT[kind];
      out[kind] = Skia.Font(f.weight === 700 ? bold : semi, f.size);
    }
    return out;
  }, [semi, bold]);
}

/**
 * Manrope 600 for leg flight-time pills (item 15, 12/16). Null until loaded;
 * the pills wait, nothing else does.
 */
export function useLegTimeFont(): SkFont | null {
  const semi = useTypeface(fontAssets.Manrope_600SemiBold);
  return useMemo(() => (semi ? Skia.Font(semi, LEG_TIME_PILL.fontSize) : null), [semi]);
}
