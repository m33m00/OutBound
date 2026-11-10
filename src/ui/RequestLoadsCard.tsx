import { StyleSheet, Text, View } from 'react-native';

import { creditsWord, REQUEST_COST, TIER_LABEL, type Tier } from '@/membership/membership';
import { spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { useCardSurface } from './cardSurface';
import { Icon } from './Icon';

/**
 * Seats hidden on Free and Pay as you go until you request them (round 176, John). Sits at the top
 * of an open route: one credit sends the route's loads to My Trips. Out of credits, it points to
 * answering loads instead.
 */
export function RequestLoadsCard({
  tier,
  credits,
  onRequest,
  onAnswerLoads,
}: {
  tier: Tier;
  credits: number;
  onRequest: () => void;
  onAnswerLoads: () => void;
}) {
  const c = useColors();
  const card = useCardSurface();
  const enough = credits >= REQUEST_COST;
  return (
    <View style={[card, styles.card]} testID="request-loads">
      <View style={styles.head}>
        <View style={[styles.iconTile, { backgroundColor: c.surface2 }]}>
          <Icon name="lock.fill" size={15} tintColor={c.muted} fallback={null} />
        </View>
        <View style={styles.headText}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
            Seats are hidden
          </Text>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="request-loads-note">
            {enough
              ? `On ${TIER_LABEL[tier]}, request this route’s loads for ${creditsWord(REQUEST_COST)}. You have ${credits}.`
              : 'You’re out of credits. Answer a load at your airline to earn one.'}
          </Text>
        </View>
      </View>
      {enough ? (
        <Button
          label="Request Loads"
          icon="ticket.fill"
          onPress={onRequest}
          accessibilityHint="Spends a credit and opens My Trips"
        />
      ) : (
        <Button label="Answer Loads" kind="secondary" icon="text.bubble" onPress={onAnswerLoads} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.rowX, gap: spacing.group, marginBottom: spacing.group },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  headText: { flex: 1, gap: 2 },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
