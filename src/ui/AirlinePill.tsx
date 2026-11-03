import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';

/**
 * Airline badge: pill + plane glyph + IATA code (DECISIONS.md: no logos).
 * One neutral color for every airline so it never reads as a tier: on the Departure board it's a
 * grey chip with the flight number in bold mono, like a board's flight column (round 117).
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
  return (
    <View style={[styles.pill, { backgroundColor: c.surface2, borderColor: c.line2 }]}>
      <Icon
        name="airplane"
        size={large ? 13 : 11}
        tintColor={c.muted}
        fallback={<Text style={[textStyles.small, { color: c.muted }]}>✈</Text>}
      />
      <Text style={[text, { fontFamily: fonts.mono, color: c.text }]}>
        {airline} {flightNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm - 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
