import { StyleSheet, Text, View } from 'react-native';

import { radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';

/**
 * Airline badge: pill + plane glyph + IATA code (DECISIONS.md: no logos).
 * One neutral accent color for every airline so it never reads as a tier.
 */
export function AirlinePill({ airline, flightNumber }: { airline: string; flightNumber: string }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: c.accentSoft }]}>
      <Icon
        name="airplane"
        size={11}
        tintColor={c.accent}
        fallback={<Text style={[textStyles.small, { color: c.accent }]}>✈</Text>}
      />
      <Text style={[textStyles.small, { color: c.accent }]}>
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
    borderRadius: radius.sm,
  },
});
