import { StyleSheet, Text, View } from 'react-native';

import { groupDigits, type LogbookHighlights, type LogbookTotals } from '@/logbook/logbook';
import { forSpeech } from '@/search/format';
import { type SFSymbol } from 'expo-symbols';

import { spacing, textStyles, useColors } from '@/theme';

import { useCardSurface } from './cardSurface';
import { Icon } from './Icon';

/**
 * Flights, miles and airports across the whole logbook, big numbers up top.
 * Under them, your most-flown airport and longest flight (round 62).
 */
export function LogbookTotalsCard({ totals, highlights }: { totals: LogbookTotals; highlights?: LogbookHighlights }) {
  const c = useColors();
  const card = useCardSurface();
  const cells = [
    { n: totals.flights, one: 'Flight', many: 'Flights' },
    { n: totals.miles, one: 'Mile', many: 'Miles' },
    { n: totals.airports, one: 'Airport', many: 'Airports' },
  ];
  const lines = [
    highlights?.topAirport ? `Most flown: ${highlights.topAirport.code} (${highlights.topAirport.flights} flights)` : null,
    highlights?.longest
      ? `Longest: ${highlights.longest.from} → ${highlights.longest.to} (${groupDigits(highlights.longest.miles)} mi)`
      : null,
  ].filter((l): l is string => l != null);
  // The same highlights as rows: an icon and a label on the left, the answer on the right (round 163).
  const rows: { key: string; icon: SFSymbol; label: string; value: string; sub: string }[] = [];
  if (highlights?.topAirport) {
    const n = highlights.topAirport.flights;
    rows.push({
      key: 'top',
      icon: 'mappin.and.ellipse',
      label: 'Most flown',
      value: highlights.topAirport.code,
      sub: `${n} ${n === 1 ? 'flight' : 'flights'}`,
    });
  }
  if (highlights?.longest) {
    const l = highlights.longest;
    rows.push({
      key: 'longest',
      icon: 'airplane',
      label: 'Longest',
      value: `${l.from} → ${l.to}`,
      sub: `${groupDigits(l.miles)} mi`,
    });
  }
  const label = cells.map((x) => `${groupDigits(x.n)} ${(x.n === 1 ? x.one : x.many).toLowerCase()}`).join(', ');
  return (
    <View
      accessible
      accessibilityLabel={[label, ...lines.map((l) => forSpeech(l.replace(' mi)', ' miles)')))].join('. ')}
      style={[card, styles.card]}
      testID="logbook-totals">
      <View style={styles.cells}>
        {cells.map((x, i) => (
          <View
            key={x.many}
            style={[styles.cell, i > 0 && { borderLeftColor: c.line, borderLeftWidth: StyleSheet.hairlineWidth }]}>
            <Text
              lineBreakStrategyIOS="push-out"
              style={[textStyles.number, { color: c.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {groupDigits(x.n)}
            </Text>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
              {x.n === 1 ? x.one : x.many}
            </Text>
          </View>
        ))}
      </View>
      {rows.length ? (
        <View style={[styles.lines, { borderTopColor: c.line }]}>
          {rows.map((x) => (
            <View key={x.key} style={styles.row} testID={`logbook-highlight-${x.key}`}>
              <Icon name={x.icon} size={15} tintColor={c.muted} fallback={null} />
              <Text
                lineBreakStrategyIOS="push-out"
                style={[textStyles.body, styles.rowLabel, { color: c.muted }]}
                numberOfLines={1}>
                {x.label}
              </Text>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]} numberOfLines={1}>
                {x.value}
              </Text>
              <Text
                lineBreakStrategyIOS="push-out"
                style={[textStyles.small, styles.rowSub, { color: c.muted }]}
                numberOfLines={1}>
                {x.sub}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.page,
    gap: spacing.section,
  },
  cells: { flexDirection: 'row' },
  lines: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.section,
    marginHorizontal: spacing.page,
    gap: spacing.group,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: 28 },
  rowLabel: { flex: 1 },
  rowSub: { minWidth: 64, textAlign: 'right' },
  cell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.group },
});
