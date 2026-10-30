import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { atAirportNote } from '@/requests/atAirport';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { Icon } from './Icon';

export interface AtAirportCardProps {
  /** Airport you're at. */
  code: string;
  /** Flights still to leave in the next 5 hours (the card's count). */
  upcoming: number;
  /** Anything on the board, counting flights that left in the last 30 minutes (shows Report). */
  onBoard: number;
  onReport: () => void;
}

/** "At DAL? Report a load" on the Search tab when you're at an airport (DECISIONS.md, round 33). */
export function AtAirportCard({ code, upcoming, onBoard, onReport }: AtAirportCardProps) {
  const c = useColors();
  // Large text: the button gets its own full-width row, like the Leave-by card.
  const stacked = useWindowDimensions().fontScale >= 1.3;
  const note = atAirportNote(code, upcoming);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]} testID="at-airport-card">
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Icon
          name="airplane.departure"
          size={18}
          tintColor={c.accent}
          fallback={<Text style={[textStyles.bodyStrong, { color: c.accent }]}>✈</Text>}
        />
      </View>
      <View
        style={styles.text}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`At ${code}? Report a load. ${note}`}>
        <Text style={[textStyles.heading, { color: c.text }]}>
          {`At ${code}? Report a load`}
        </Text>
        <Text style={[textStyles.small, { color: c.muted }]}>{note}</Text>
      </View>
      {onBoard ? (
        // Secondary: searching stays the main job on this tab.
        <Button
          label="Report"
          kind="secondary"
          onPress={onReport}
          accessibilityLabel={`Report a load at ${code}`}
          style={[styles.button, stacked && styles.buttonStacked]}
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
  buttonStacked: { flexBasis: '100%' },
});
