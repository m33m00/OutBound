import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';

/**
 * Airline badge: pill + plane glyph + IATA code (DECISIONS.md: no logos).
 * One neutral accent color for every airline so it never reads as a tier; the flight number in mono
 * (round 120, the Clean look).
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
    <View style={[styles.pill, { backgroundColor: c.accentSoft }]}>
      <Icon
        name="airplane"
        size={large ? 13 : 11}
        tintColor={c.accent}
        fallback={<Text style={[textStyles.small, { color: c.accent }]}>✈</Text>}
      />
      <Text style={[text, { fontFamily: fonts.mono, color: c.accent }]}>
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm - 2,
  },
});
