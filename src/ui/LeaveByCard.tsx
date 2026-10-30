import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, Text, View } from 'react-native';

import type { Airport } from '@/engine';
import { computeLeaveBy, leaveByText, LOCATION_FRESH_MS, type PhoneLocation } from '@/search/leaveBy';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { Icon } from './Icon';
import type { LocationStatus } from './useCurrentLocation';

export interface LeaveByCardProps {
  /** Departure airport of the selected route's first leg. */
  airport: Airport;
  departUtc: number;
  bufferMin: number;
  now: number;
  location: PhoneLocation | null;
  locationStatus: LocationStatus;
  onUseLocation: () => void;
}

/** When to leave for the selected route (backlog 12; Q-003, Q-023). */
export function LeaveByCard(p: LeaveByCardProps) {
  const c = useColors();
  const result = computeLeaveBy(p);
  const text = leaveByText(result, p.airport.tz);
  const atAirport = result.kind === 'atAirport';
  const fresh = p.location != null && p.now - p.location.at <= LOCATION_FRESH_MS;
  const offerLocation = !fresh && !atAirport && p.locationStatus !== 'locating';
  // Say the leave-by line once when a route is picked; VoiceOver focus stays on the row.
  const firstTitle = useRef(text.title);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(firstTitle.current);
  }, []);
  const note =
    p.locationStatus === 'denied'
      ? 'Location is off for OutBound. Turn it on in iPhone Settings to get a drive estimate.'
      : p.locationStatus === 'locating'
        ? 'Finding your location…'
        : null;

  return (
    <View style={[styles.card, { backgroundColor: atAirport ? c.goodBg : c.accentSoft }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: c.surface }]}>
          <Icon
            name={atAirport ? 'airplane.departure' : 'car.fill'}
            size={18}
            tintColor={atAirport ? c.goodFg : c.accent}
            fallback={<Text style={[textStyles.heading, { color: c.accent }]}>⏱</Text>}
          />
        </View>
        {/* One VoiceOver element for the text; buttons stay separately reachable. */}
        <View style={styles.text} accessible accessibilityLabel={[text.title, text.sub, note].filter(Boolean).join('. ')}>
          <Text style={[textStyles.heading, { color: atAirport ? c.goodFg : c.text }]}>{text.title}</Text>
          <Text style={[textStyles.small, { color: c.muted }]}>{text.sub}</Text>
          {note ? <Text style={[textStyles.small, { color: c.muted }]}>{note}</Text> : null}
        </View>
      </View>
      {/* Own row so large text never squeezes the time. */}
      {p.locationStatus === 'denied' ? (
        <Button label="Open Settings" kind="secondary" onPress={() => Linking.openSettings()} style={styles.action} />
      ) : offerLocation ? (
        <Button label="Use Location" kind="secondary" onPress={p.onUseLocation} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.group,
    padding: spacing.rowX,
    borderRadius: radius.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.section },
  action: { alignSelf: 'flex-start' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
