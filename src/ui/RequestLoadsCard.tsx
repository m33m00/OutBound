import { StyleSheet, Text, View } from 'react-native';

import { creditsWord, REQUEST_COST, TIER_LABEL, type Tier } from '@/membership/membership';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button, PillButton } from './Buttons';
import { useCardSurface } from './cardSurface';
import { Icon } from './Icon';

export interface RequestLeg {
  from: string;
  to: string;
  /** Departure time as the route shows it, e.g. "11:40 AM". */
  departText: string;
  /** Seats still hidden on this leg. */
  locked: boolean;
}

/**
 * Seats hidden on Free and Pay as you go until you request them (round 176, John). Sits at the top
 * of an open route.
 *
 * Round 189, John: "it should be 1 credit per leg. Not route. ... a 'quick request' button on each
 * leg so that I have the option to either request the full route or select single/multiple legs."
 * A route with more than one leg lists each leg with its own quick request (1 credit); the main
 * button requests every leg still hidden and says what that costs (shown only when you have enough).
 * Requested legs say so. Out of credits, it points to answering loads instead.
 */
export function RequestLoadsCard({
  tier,
  credits,
  legs,
  onRequest,
  onAnswerLoads,
}: {
  tier: Tier;
  credits: number;
  legs: readonly RequestLeg[];
  /** The legs (indexes into `legs`) to request. */
  onRequest: (legs: number[]) => void;
  onAnswerLoads: () => void;
}) {
  const c = useColors();
  const card = useCardSurface();
  const locked = legs.flatMap((l, i) => (l.locked ? [i] : []));
  const allCost = locked.length * REQUEST_COST;
  const multi = legs.length > 1;
  const canOne = credits >= REQUEST_COST;
  const canAll = credits >= allCost;
  const note = !canOne
    ? 'You’re out of credits. Answer a load at your airline to earn one.'
    : `On ${TIER_LABEL[tier]}, loads are ${creditsWord(REQUEST_COST)} per leg. You have ${credits}${
        canAll ? '' : `, enough for ${credits === 1 ? '1 leg' : `${Math.floor(credits / REQUEST_COST)} legs`}`
      }.`;
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
            {note}
          </Text>
        </View>
      </View>
      {multi ? (
        <View style={styles.legs}>
          {legs.map((l, i) => {
            const name = `${l.from} to ${l.to}`;
            return (
              <View
                key={`${l.from}-${l.to}-${i}`}
                style={[styles.leg, { backgroundColor: c.surface2 }]}
                testID={`request-leg-${i}`}>
                <View style={styles.legText} accessible accessibilityLabel={`${name}, ${l.departText}`}>
                  <View style={styles.codes}>
                    <Text style={[textStyles.bodyStrong, { color: c.text }]}>{l.from}</Text>
                    <Icon name="airplane" size={13} tintColor={c.muted} fallback={null} />
                    <Text style={[textStyles.bodyStrong, { color: c.text }]}>{l.to}</Text>
                  </View>
                  <Text style={[textStyles.small, { color: c.muted }]}>{l.departText}</Text>
                </View>
                {l.locked ? (
                  <PillButton
                    label={creditsWord(REQUEST_COST)}
                    leading="ticket.fill"
                    onPress={() => onRequest([i])}
                    disabled={!canOne}
                    accessibilityLabel={`Request ${name} loads, ${creditsWord(REQUEST_COST)}`}
                    testID={`request-leg-${i}-quick`}
                  />
                ) : (
                  <View style={styles.done} accessible accessibilityLabel={`${name} loads requested`}>
                    <Icon name="checkmark" size={14} weight="semibold" tintColor={c.muted} fallback={null} />
                    <Text style={[textStyles.small, { color: c.muted }]}>Requested</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {!canOne ? (
        <Button label="Answer Loads" kind="secondary" icon="text.bubble" onPress={onAnswerLoads} />
      ) : canAll && (!multi || locked.length > 1) ? (
        <Button
          label={multi ? `Request All Legs, ${creditsWord(allCost)}` : `Request Loads, ${creditsWord(allCost)}`}
          icon="ticket.fill"
          onPress={() => onRequest(locked)}
          accessibilityHint="Spends the credits and shows the seats"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.rowX, gap: spacing.group, marginBottom: spacing.group },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  headText: { flex: 1, gap: 2 },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  legs: { gap: 8 },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  legText: { flex: 1, gap: 1 },
  codes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
});
