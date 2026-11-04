import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { atAirportNote } from '@/requests/atAirport';
import { elevation, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { Icon } from './Icon';
import { pressStyle } from './press';

export interface AtAirportCardProps {
  /** Airport you're at. */
  code: string;
  /** Flights still to leave in the next 5 hours (the card's count). */
  upcoming: number;
  /** Anything on the board, counting flights that left in the last 30 minutes (shows Report). */
  onBoard: number;
  onReport: () => void;
  /** Hides the card (the X; John, 2026-11-02: "should be able to dismiss"). */
  onDismiss?: () => void;
}

/** "At DAL? Report a load" on the Search tab when you're at an airport (DECISIONS.md, round 33). */
export function AtAirportCard({ code, upcoming, onBoard, onReport, onDismiss }: AtAirportCardProps) {
  const c = useColors();
  // Large text: the button gets its own full-width row, like the Leave-by card.
  const stacked = useWindowDimensions().fontScale >= 1.3;
  const note = atAirportNote(code, upcoming);
  return (
    <View
      style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: c.line, shadowColor: c.text }]}
      testID="at-airport-card">
      {/* Gray, not the accent: the icon isn't the tap (round 139). */}
      <View style={[styles.icon, { backgroundColor: c.surface2 }]}>
        <Icon
          name="airplane.departure"
          size={16}
          tintColor={c.muted}
          fallback={<Text style={[textStyles.bodyStrong, { color: c.muted }]}>✈</Text>}
        />
      </View>
      <View style={styles.text} accessible accessibilityRole="header" accessibilityLabel={`At ${code}? Report a load. ${note}`}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.text }]}>
          {`At ${code}? Report a load`}
        </Text>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          {note}
        </Text>
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
      {onDismiss ? (
        // A small round X on the card's top-right corner, like a notification's (John, 2026-11-02:
        // the X on its own row looked out of place). Swiping the banner up does the same.
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={10}
          style={pressStyle([styles.close, { backgroundColor: c.surface, borderColor: c.line, shadowColor: c.text }], 'link')}
          testID="at-airport-dismiss">
          <Icon
            name="xmark"
            size={10}
            weight="bold"
            tintColor={c.muted}
            fallback={<Text style={[textStyles.small, { color: c.muted }]}>×</Text>}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const CLOSE = 24;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    // Slim, so the home drawer shows it without a scroll (John, 2026-11-02).
    columnGap: spacing.group,
    rowGap: spacing.group,
    paddingVertical: spacing.group,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 180, gap: 2 },
  button: { paddingHorizontal: spacing.section },
  buttonStacked: { flexBasis: '100%' },
  // Tight to the card's right edge; the tap target still meets the minimum.
  // 24 pt to look at, on the card's top-right corner; hitSlop takes the tap target past 44 pt.
  close: {
    position: 'absolute',
    top: -CLOSE / 4,
    right: -CLOSE / 4,
    width: CLOSE,
    height: CLOSE,
    borderRadius: CLOSE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
