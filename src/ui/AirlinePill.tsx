import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';

/**
 * Each airline's mark (round 132, John: "can we not use airline logos? Instead of WN, UA, DL, AA"): a
 * small tail in the airline's own colors with a plane on it, so you know the airline at a glance
 * without reading a code. These are our own simple marks in each airline's colors, not their logos,
 * which are trademarks. The name is still spoken. An airline we don't know shows its code as before.
 */
export interface AirlineMarkStyle {
  name: string;
  /** The tail's color, the stripe across its corner, and the plane's color. */
  tail: string;
  stripe: string;
  glyph: string;
  /** The airline's web domain, which is how the logo service finds its logo. */
  domain: string;
}

export const AIRLINE_MARKS: Record<string, AirlineMarkStyle> = {
  AA: { name: 'American', tail: '#0078D2', stripe: '#C30019', glyph: '#FFFFFF', domain: 'aa.com' },
  AC: { name: 'Air Canada', tail: '#1A1A1A', stripe: '#F01428', glyph: '#FFFFFF', domain: 'aircanada.com' },
  AS: { name: 'Alaska', tail: '#01426A', stripe: '#48A9C5', glyph: '#FFFFFF', domain: 'alaskaair.com' },
  B6: { name: 'JetBlue', tail: '#003876', stripe: '#1E90FF', glyph: '#FFFFFF', domain: 'jetblue.com' },
  DL: { name: 'Delta', tail: '#003366', stripe: '#C8102E', glyph: '#FFFFFF', domain: 'delta.com' },
  F9: { name: 'Frontier', tail: '#248168', stripe: '#9BD3AE', glyph: '#FFFFFF', domain: 'flyfrontier.com' },
  NK: { name: 'Spirit', tail: '#FFE500', stripe: '#1A1A1A', glyph: '#1A1A1A', domain: 'spirit.com' },
  UA: { name: 'United', tail: '#0033A0', stripe: '#6CACE4', glyph: '#FFFFFF', domain: 'united.com' },
  WN: { name: 'Southwest', tail: '#304CB2', stripe: '#FFBF27', glyph: '#FFFFFF', domain: 'southwest.com' },
};

/**
 * Real airline logos (round 133, John: "Yes, find real logos") come from Logo.dev, whose terms allow
 * showing logos in an app to identify a brand, with a visible "Logos provided by Logo.dev" link on
 * the free plan. Its publishable key is public by design (like the Supabase anon key) and comes from
 * the build env, never from git. With no key, or when a logo fails to load, the tail mark shows.
 */
const LOGO_KEY = process.env.EXPO_PUBLIC_LOGO_DEV_KEY;

/** True when real logos are switched on, so Settings shows the Logo.dev credit. */
export function logosOn(key = LOGO_KEY): boolean {
  return !!key;
}

/** The logo's address for an airline at `size` points, or null when logos are off or unknown. */
export function airlineLogoUrl(code: string, size: number, key = LOGO_KEY, dark = false): string | null {
  const m = AIRLINE_MARKS[code];
  if (!key || !m) return null;
  const px = Math.round(size * 2);
  // On a dark background Logo.dev lightens a dark logo so it doesn't vanish (round 134).
  return `https://img.logo.dev/${m.domain}?token=${encodeURIComponent(key)}&size=${px}&format=png&retina=true&fallback=404${
    dark ? '&theme=dark' : ''
  }`;
}

/** The airline's name for speech and labels, or its code when we don't know it. */
export function airlineName(code: string): string {
  return AIRLINE_MARKS[code]?.name ?? code;
}

/**
 * The airline's logo in a round badge, the same circle for every airline (round 161, John: "Can the airline
 * logos all be in a round circle badges so it's all consistent"). The logo fills a white disc with a hairline
 * ring, so a logo that comes as a colored square (Delta's navy one) reads as a colored circle like the rest.
 * With no logo, the disc takes the airline's tail color with a white plane. `size` points across.
 */
export function AirlineMark({
  airline,
  size = 18,
  logoKey = LOGO_KEY,
}: {
  airline: string;
  size?: number;
  logoKey?: string;
  /** Kept for callers; every mark is the same round badge now (round 161). */
  bare?: boolean;
}) {
  const c = useColors();
  const m = AIRLINE_MARKS[airline];
  const [failed, setFailed] = useState(false);
  if (!m) return null;
  // The disc is always white, so the logo is asked for in its light form.
  const url = failed ? null : airlineLogoUrl(airline, size, logoKey, false);
  const disc = { width: size, height: size, borderRadius: size / 2, borderColor: c.line };
  if (url) {
    return (
      <View style={[styles.mark, styles.badge, disc, { backgroundColor: '#ffffff' }]} testID="airline-logo">
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          contentFit="cover"
          cachePolicy="disk"
          accessibilityIgnoresInvertColors
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <View style={[styles.mark, styles.badge, disc, { backgroundColor: m.tail }]} testID="airline-mark">
      <Icon
        name="airplane"
        size={size * 0.56}
        tintColor={m.glyph}
        fallback={<Text style={{ color: m.glyph, fontSize: size * 0.5, lineHeight: size * 0.65 }}>✈</Text>}
      />
    </View>
  );
}

/**
 * Airline badge: the airline's mark and the flight number in mono (round 132). Unknown airlines keep
 * the earlier neutral pill with a plane and the code.
 */
export function AirlinePill({
  airline,
  flightNumber,
  large,
}: {
  airline: string;
  flightNumber: string;
  /** Body-size text, for the route view. */
  large?: boolean;
}) {
  const c = useColors();
  const text = large ? textStyles.bodyStrong : textStyles.small;
  const known = !!AIRLINE_MARKS[airline];
  return (
    <View
      // Plain like the airport pills beside it: black text, no navy (round 136, John).
      style={[styles.pill, { backgroundColor: c.surface, borderColor: c.line }]}
      accessible
      accessibilityLabel={`${airlineName(airline)} ${flightNumber}`}
      testID="airline-pill">
      {known ? (
        <AirlineMark airline={airline} size={logosOn() ? (large ? 28 : 22) : large ? 20 : 16} />
      ) : (
        <Icon
          name="airplane"
          size={large ? 13 : 11}
          tintColor={c.muted}
          fallback={<Text style={[textStyles.small, { color: c.muted }]}>✈</Text>}
        />
      )}
      <Text style={[text, { fontFamily: fonts.mono, color: c.text }]}>{`${airline} ${flightNumber}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 3,
    paddingRight: 8,
    paddingVertical: 2,
    borderRadius: radius.sm - 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mark: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { borderWidth: StyleSheet.hairlineWidth },
});
