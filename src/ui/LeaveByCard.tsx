import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Airport } from '@/engine';
import { forSpeech } from '@/search/format';
import { MAPS_APP_NAME, type MapsApp } from '@/search/directions';
import { computeLeaveBy, leaveByText, LOCATION_FRESH_MS, type PhoneLocation } from '@/search/leaveBy';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { Icon } from './Icon';
import { openDirections } from './openDirections';
import { pressStyle } from './press';
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
  /** Live status says the first flight has left (Q-050: never from the schedule). */
  departed?: boolean;
  /** Live delayed departure, local text ("2:40 PM"). Shown under the times; leave-by still uses the schedule (Q-070, John: C). */
  delayedText?: string | null;
  /** Where a tap on the card opens directions to the airport (Settings, default Apple Maps). */
  mapsApp?: MapsApp;
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
  const departed = result.kind === 'departed';
  // Tap for directions while there's still a trip to the airport (John, 2026-10-30).
  const directions = !atAirport && !departed;
  const mapsApp = p.mapsApp ?? 'apple';
  const go = () => void openDirections(p.airport, mapsApp);
  // "10:45 AM" never splits across lines.
  const keepTimes = (s: string) => s.replace(/(\d) (AM|PM)/g, '$1\u00a0$2');
  const fresh = p.location != null && p.now - p.location.at <= LOCATION_FRESH_MS;
  // A drive estimate can't help once the flight has left.
  const offerLocation = !fresh && !atAirport && !departed && p.locationStatus !== 'locating';
  // The schedule stays the safe time to work from; the delay is shown, not counted (Q-070).
  const delayLine = !departed && p.delayedText ? `Flight delayed to ${p.delayedText}` : null;
  // Say the leave-by line once when a route is picked; VoiceOver focus stays on the row.
  // Departed says why too, and is said again if the flight leaves while the card is open; a delay is said with the title.
  const spokenTitle = departed ? `${text.title}. ${text.sub}` : [text.title, delayLine].filter(Boolean).join('. ');
  const firstTitle = useRef(spokenTitle);
  const wasDeparted = useRef(departed);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(firstTitle.current);
  }, []);
  useEffect(() => {
    if (departed && !wasDeparted.current) AccessibilityInfo.announceForAccessibility?.(spokenTitle);
    wasDeparted.current = departed;
  }, [departed, spokenTitle]);
  // A delay that turns up after a refresh is said once, like Departed.
  const lastDelay = useRef(delayLine);
  useEffect(() => {
    if (delayLine && delayLine !== lastDelay.current) AccessibilityInfo.announceForAccessibility?.(delayLine);
    lastDelay.current = delayLine;
  }, [delayLine]);
  const note = departed
    ? null
    : p.locationStatus === 'denied'
      ? 'Location is off for OutBound. Turn it on in iPhone Settings to get a drive estimate.'
      : p.locationStatus === 'locating'
        ? 'Finding your location…'
        : null;

  // Outlined so it stands out on the tinted card (it used to be gray on light blue).
  const outline = [styles.action, styles.outline, inline && styles.inline, { backgroundColor: c.surface, borderColor: c.accent }];
  const action = departed ? null : p.locationStatus === 'denied' ? (
      <Button label="Open Settings" kind="secondary" onPress={() => Linking.openSettings()} style={outline} />
    ) : offerLocation ? (
      <Button label="Use Location" kind="secondary" onPress={p.onUseLocation} style={outline} />
    ) : null;

  return (
    // "You're at DFW" is about you, so amber (amber = you), never a seat-tier green.
    // The whole card opens directions; VoiceOver gets the same from the title, so the location button stays its own stop.
    <Pressable
      accessible={false}
      disabled={!directions}
      onPress={go}
      testID="leave-by-card"
      style={pressStyle([styles.card, { backgroundColor: atAirport ? c.youBg : departed ? c.surface2 : c.accentSoft }])}>
      <View style={styles.top} testID="leave-by-top">
        {/* One VoiceOver element for the text (the lines below are read with the title); buttons stay separately reachable. */}
        <View
          style={styles.text}
          accessible
          accessibilityRole={directions ? 'button' : undefined}
          accessibilityHint={directions ? `Opens directions in ${MAPS_APP_NAME[mapsApp]}` : undefined}
          onAccessibilityTap={directions ? go : undefined}
          // TalkBack has no accessibility tap, so activation runs the same.
          accessibilityActions={directions ? [{ name: 'activate' }] : undefined}
          onAccessibilityAction={directions ? go : undefined}
          accessibilityLabel={forSpeech([text.title, text.sub, delayLine, note].filter(Boolean).join('. '))}>
          <Text style={[textStyles.heading, { color: atAirport ? c.youText : c.text }]} lineBreakStrategyIOS="push-out">
            {keepTimes(text.title)}
          </Text>
        </View>
        {action && inline ? action : null}
        {/* The chevron is the card's only sign that it opens directions, so it always shows. */}
        {directions ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="chevron.right" size={13} weight="semibold" tintColor={c.muted} fallback={<Text style={{ color: c.muted }}>›</Text>} />
          </View>
        ) : null}
      </View>
      {/* The small lines use the card's full width, so they don't squeeze beside the button and drop one word (John, 2026-10-30). */}
      <View style={styles.details} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[textStyles.small, { color: c.muted }]} lineBreakStrategyIOS="push-out">
          {keepTimes(text.sub)}
        </Text>
        {delayLine ? (
          <Text
            style={[textStyles.small, { color: c.caution, fontFamily: textStyles.bodyStrong.fontFamily }]}
            lineBreakStrategyIOS="push-out">
            {delayLine}
          </Text>
        ) : null}
        {note ? (
          <Text style={[textStyles.small, { color: c.muted }]} lineBreakStrategyIOS="push-out">
            {note}
          </Text>
        ) : null}
      </View>
      {/* Own row at large text sizes so the time is never squeezed. */}
      {action && !inline ? action : null}
    </Pressable>
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
  text: { flex: 1 },
  // Pulled up under the title so it reads as the title's caption. No icon tile (design audit,
  // round 69): the chevron says it opens directions, and the lines get the card's full width.
  details: { gap: 2, marginTop: -6 },
});
