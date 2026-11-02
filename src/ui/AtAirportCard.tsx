import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { atAirportNote } from '@/requests/atAirport';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

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
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]} testID="at-airport-card">
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Icon
          name="airplane.departure"
          size={16}
          tintColor={c.accent}
          fallback={<Text style={[textStyles.bodyStrong, { color: c.accent }]}>✈</Text>}
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
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={4}
          style={pressStyle(styles.close, 'link')}
          testID="at-airport-dismiss">
          <Icon
            name="xmark"
            size={14}
            weight="semibold"
            tintColor={c.muted}
            fallback={<Text style={[textStyles.bodyStrong, { color: c.muted }]}>×</Text>}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

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
  close: {
    width: minTapTarget,
    height: minTapTarget,
    marginVertical: -8,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
