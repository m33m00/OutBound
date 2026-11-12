import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { creditsWord, REQUEST_COST } from '@/membership/membership';
import { spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';

/**
 * The pinned button's words (round 190, John: a large "request all legs for X credits" button).
 * Every leg checked: "Request All Legs for 2 credits" (a nonstop: "Request Loads for 1 credit").
 * Some unchecked: "Request 1 Leg for 1 credit". None: "Check a Leg to Request".
 */
export function requestLabel(picked: number, locked: number): string {
  if (picked <= 0) return 'Check a Leg to Request';
  const cost = creditsWord(picked * REQUEST_COST);
  if (picked >= locked) return locked > 1 ? `Request All Legs for ${cost}` : `Request Loads for ${cost}`;
  return `Request ${picked} ${picked === 1 ? 'Leg' : 'Legs'} for ${cost}`;
}

/** The line over the button: what loads cost, what you have, and what to do when it's not enough. */
export function requestNote(picked: number, credits: number): string {
  if (credits < REQUEST_COST) return 'You’re out of credits. Answer a load at your airline to earn one.';
  const cost = picked * REQUEST_COST;
  if (cost > credits) {
    const fits = Math.floor(credits / REQUEST_COST);
    return `You have ${creditsWord(credits)}, enough for ${fits} ${fits === 1 ? 'leg' : 'legs'}. Uncheck the rest.`;
  }
  return `Seats are hidden. Loads are ${creditsWord(REQUEST_COST)} per leg. You have ${credits}.`;
}

/**
 * Round 190, John: "I want to see the whole boarding pass layout with a large 'request all legs for X
 * credits' button that is static at the bottom (above the menu bar). Then each leg has a credit box on it
 * that is already checked off. Deselecting the legs/check boxes adjusts the total request amount and
 * button at the bottom." Pinned over the bottom of the open route; the checkboxes live on the pass.
 */
export function RequestLoadsBar({
  picked,
  locked,
  credits,
  onRequest,
  onAnswerLoads,
  onHeight,
}: {
  /** Legs checked. */
  picked: number;
  /** Legs whose seats are still hidden. */
  locked: number;
  credits: number;
  onRequest: () => void;
  onAnswerLoads: () => void;
  onHeight?: (height: number) => void;
}) {
  const c = useColors();
  const out = credits < REQUEST_COST;
  const affordable = picked > 0 && picked * REQUEST_COST <= credits;
  return (
    <View
      style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.line }]}
      onLayout={(e: LayoutChangeEvent) => onHeight?.(e.nativeEvent.layout.height)}
      testID="request-loads">
      <Text
        lineBreakStrategyIOS="push-out"
        style={[textStyles.small, styles.note, { color: c.muted }]}
        testID="request-loads-note">
        {requestNote(picked, credits)}
      </Text>
      {out ? (
        <Button label="Answer Loads" kind="secondary" icon="text.bubble" onPress={onAnswerLoads} />
      ) : (
        <Button
          label={requestLabel(picked, locked)}
          icon="ticket.fill"
          onPress={onRequest}
          disabled={!affordable}
          accessibilityHint={affordable ? 'Spends the credits and shows the seats' : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.page,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Centred over the button, like its label (round 191, John: "Align the subtext above the request all legs button").
  note: { textAlign: 'center', alignSelf: 'stretch' },
});
