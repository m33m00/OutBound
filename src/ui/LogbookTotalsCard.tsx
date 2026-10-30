import { StyleSheet, Text, View } from 'react-native';

import { groupDigits, type LogbookTotals } from '@/logbook/logbook';
import { radius, spacing, textStyles, useColors } from '@/theme';

/** Flights, miles and airports across the whole logbook, big numbers up top. */
export function LogbookTotalsCard({ totals }: { totals: LogbookTotals }) {
  const c = useColors();
  const cells = [
    { n: totals.flights, one: 'Flight', many: 'Flights' },
    { n: totals.miles, one: 'Mile', many: 'Miles' },
    { n: totals.airports, one: 'Airport', many: 'Airports' },
  ];
  const label = cells.map((x) => `${groupDigits(x.n)} ${(x.n === 1 ? x.one : x.many).toLowerCase()}`).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
      testID="logbook-totals">
      {cells.map((x, i) => (
        <View key={x.many} style={[styles.cell, i > 0 && { borderLeftColor: c.line, borderLeftWidth: StyleSheet.hairlineWidth }]}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.number, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {groupDigits(x.n)}
          </Text>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            {x.n === 1 ? x.one : x.many}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.page,
  },
  cell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.group },
});
