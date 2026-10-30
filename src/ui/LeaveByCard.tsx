import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Airport } from '@/engine';
import { forSpeech } from '@/search/format';
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

/** From this text size the location button gets its own row. */
export const INLINE_BUTTON_MAX_SCALE = 1.3;

/** When to leave for the selected route (backlog 12; Q-003, Q-023). */
export function LeaveByCard(p: LeaveByCardProps) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  // At normal text sizes the button sits at the end of the top row to save a row of height.
  const inline = fontScale < INLINE_BUTTON_MAX_SCALE;
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

  // Outlined so it stands out on the tinted card (it used to be gray on light blue).
  const outline = [styles.action, styles.outline, inline && styles.inline, { backgroundColor: c.surface, borderColor: c.accent }];
  const action =
    p.locationStatus === 'denied' ? (
      <Button label="Open Settings" kind="secondary" onPress={() => Linking.openSettings()} style={outline} />
    ) : offerLocation ? (
      <Button label="Use Location" kind="secondary" onPress={p.onUseLocation} style={outline} />
    ) : null;

  return (
    // "You're at DFW" is about you, so amber (amber = you), never a seat-tier green.
    <View style={[styles.card, { backgroundColor: atAirport ? c.youBg : c.accentSoft }]}>
      <View style={styles.top} testID="leave-by-top">
        <View style={[styles.icon, { backgroundColor: c.surface }]}>
          <Icon
            name={atAirport ? 'airplane.departure' : 'car.fill'}
            size={18}
            tintColor={atAirport ? c.youText : c.accent}
            fallback={<Text style={[textStyles.heading, { color: c.accent }]}>⏱</Text>}
          />
        </View>
        {/* One VoiceOver element for the text; buttons stay separately reachable. */}
        <View style={styles.text} accessible accessibilityLabel={forSpeech([text.title, text.sub, note].filter(Boolean).join('. '))}>
          <Text style={[textStyles.heading, { color: atAirport ? c.youText : c.text }]}>{text.title}</Text>
          <Text style={[textStyles.small, { color: c.muted }]}>{text.sub}</Text>
          {note ? <Text style={[textStyles.small, { color: c.muted }]}>{note}</Text> : null}
        </View>
        {action && inline ? action : null}
      </View>
      {/* Own row at large text sizes so the time is never squeezed. */}
      {action && !inline ? action : null}
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
  action: { alignSelf: 'flex-start', paddingHorizontal: spacing.section },
  outline: { borderWidth: 1 },
  inline: { alignSelf: 'center' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
