import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { AIRPORTS, type Flight } from '@/engine';
import { LOG_FROM_MS, loggedFromFlight } from '@/logbook/logbook';
import { useLogbookIfThere } from '@/logbook/LogbookProvider';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { selectionTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';

/**
 * Add to Logbook on a flight's status (round 63): from two hours before it
 * leaves, one tap logs it on its day. Once logged it says so instead.
 * Shows nothing where there's no logbook.
 */
export function LogFlightLink({ flight, now }: { flight: Flight; now: number }) {
  const c = useColors();
  const logbook = useLogbookIfThere();
  if (!logbook || now < flight.departUtc - LOG_FROM_MS) return null;
  const entry = loggedFromFlight(flight, AIRPORTS[flight.from]?.tz ?? 'UTC', now);
  const logged = logbook.flights.some((f) => f.id === entry.id);
  if (logged) {
    return (
      <View style={styles.row} accessible accessibilityLabel="In your Logbook" testID="log-flight-done">
        <Icon name="checkmark.circle.fill" size={18} tintColor={c.goodFg} fallback={null} />
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]}>In your Logbook</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        logbook.add([entry]);
        selectionTick();
        AccessibilityInfo.announceForAccessibility('Added to your Logbook');
      }}
      accessibilityRole="button"
      accessibilityLabel="Add to Logbook"
      accessibilityHint="Keeps this flight in your Logbook tab"
      testID="log-flight"
      style={pressStyle(styles.row, 'link')}>
      <Icon name="book.closed" size={18} tintColor={c.accent} fallback={null} />
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.accent }]}>Add to Logbook</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget, alignSelf: 'flex-start' },
});
