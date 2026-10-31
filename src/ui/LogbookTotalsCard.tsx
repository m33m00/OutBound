import { StyleSheet, Text, View } from 'react-native';

import { groupDigits, type LogbookHighlights, type LogbookTotals } from '@/logbook/logbook';
import { forSpeech } from '@/search/format';
import { radius, spacing, textStyles, useColors } from '@/theme';

/**
 * Flights, miles and airports across the whole logbook, big numbers up top.
 * Under them, your most-flown airport and longest flight (round 62).
 */
export function LogbookTotalsCard({ totals, highlights }: { totals: LogbookTotals; highlights?: LogbookHighlights }) {
  const c = useColors();
  const cells = [
    { n: totals.flights, one: 'Flight', many: 'Flights' },
    { n: totals.miles, one: 'Mile', many: 'Miles' },
    { n: totals.airports, one: 'Airport', many: 'Airports' },
  ];
  const lines = [
    highlights?.topAirport ? `Most flown: ${highlights.topAirport.code} · ${highlights.topAirport.flights} flights` : null,
    highlights?.longest
      ? `Longest: ${highlights.longest.from} → ${highlights.longest.to} · ${groupDigits(highlights.longest.miles)} mi`
      : null,
  ].filter((l): l is string => l != null);
  const label = cells.map((x) => `${groupDigits(x.n)} ${(x.n === 1 ? x.one : x.many).toLowerCase()}`).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={[label, ...lines.map((l) => forSpeech(l.replace(' mi', ' miles')))].join('. ')}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
      testID="logbook-totals">
      <View style={styles.cells}>
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
      {lines.length ? (
        <View style={[styles.lines, { borderTopColor: c.line }]}>
          {lines.map((l) => (
            <Text key={l} lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.page,
    gap: spacing.section,
  },
  cells: { flexDirection: 'row' },
  lines: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.section,
    marginHorizontal: spacing.page,
    gap: 2,
  },
  cell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.group },
});
