import { Pressable, StyleSheet, Text, View } from 'react-native';

import { flightMiles, groupDigits, loggedDay, type LoggedFlight } from '@/logbook/logbook';
import { forSpeech } from '@/search/format';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { AirlinePill } from './AirlinePill';
import { Icon } from './Icon';
import { pressStyle } from './press';

export interface LoggedFlightRowProps {
  flight: LoggedFlight;
  /** Clock for "Today" and "Yesterday". */
  now: number;
  onRemove: () => void;
  /** Opens the flight to fix its details. */
  onEdit?: () => void;
}

/**
 * One logged flight: route, airline code and number, day, seat, miles.
 * Tapping it opens the flight to fix (round 61). The trash button sits apart
 * so VoiceOver reaches it on its own, and asks first.
 */
export function LoggedFlightRow({ flight: f, now, onRemove, onEdit }: LoggedFlightRowProps) {
  const c = useColors();
  const route = `${f.from} → ${f.to}`;
  const day = loggedDay(f.date, now);
  const miles = flightMiles(f.from, f.to);
  const detail = [day, f.seat ? `Seat ${f.seat}` : null].filter(Boolean).join(' · ');
  const label = [route, `${f.airline} ${f.flightNumber}`, detail, miles != null ? `${groupDigits(miles)} miles` : null]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={styles.row} testID="logged-flight">
      <Pressable
        onPress={onEdit}
        disabled={!onEdit}
        accessibilityRole={onEdit ? 'button' : undefined}
        accessibilityLabel={forSpeech(label)}
        accessibilityHint={onEdit ? 'Opens it to fix the details' : undefined}
        testID="edit-logged-flight"
        style={pressStyle(styles.main)}>
        <View style={styles.top}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>{route}</Text>
          {miles != null ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.miles, { color: c.muted }]}>
              {`${groupDigits(miles)} mi`}
            </Text>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <AirlinePill airline={f.airline} flightNumber={f.flightNumber} />
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.detail, { color: c.muted }]}>{detail}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${forSpeech(route)}, ${day}`}
        testID="remove-logged-flight"
        style={pressStyle(styles.remove, 'link')}>
        <Icon
          name="trash"
          size={17}
          tintColor={c.muted}
          fallback={<Text style={[textStyles.small, { color: c.muted }]}>Remove</Text>}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.rowX },
  main: { flex: 1, gap: 4, paddingVertical: spacing.rowY },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.group },
  miles: { marginLeft: 'auto' },
  bottom: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  detail: { flexShrink: 1 },
  remove: { minWidth: minTapTarget, minHeight: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
