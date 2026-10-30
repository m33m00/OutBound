import { StyleSheet, Text, View } from 'react-native';

import { atAirportNote } from '@/requests/atAirport';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { Icon } from './Icon';

export interface AtAirportCardProps {
  /** Airport you're at. */
  code: string;
  /** Departures on the board now. */
  count: number;
  onReport: () => void;
}

/** "At DAL? Report a load" on the Search tab when you're at an airport (DECISIONS.md, round 33). */
export function AtAirportCard({ code, count, onReport }: AtAirportCardProps) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]} testID="at-airport-card">
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Icon name="airplane.departure" size={18} tintColor={c.accent} fallback={null} />
      </View>
      <View style={styles.text}>
        <Text style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
          {`At ${code}? Report a load`}
        </Text>
        <Text style={[textStyles.small, { color: c.muted }]}>{atAirportNote(code, count)}</Text>
      </View>
      {count ? (
        <Button
          label="Report"
          onPress={onReport}
          accessibilityLabel={`Report a load at ${code}`}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.section,
    padding: spacing.rowX,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 180, gap: 2 },
  button: { paddingHorizontal: spacing.section },
});
