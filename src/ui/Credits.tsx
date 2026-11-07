import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  balance,
  creditsWord,
  deltaText,
  EARN_PER_ANSWER,
  earnedTotal,
  REQUEST_COST,
  spentTotal,
  TIER_LABEL,
  type Tier,
  type Wallet,
} from '@/membership/membership';
import { useMembership } from '@/membership/MembershipProvider';
import { formatAge } from '@/search/format';
import { fonts, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { useCardSurface } from './cardSurface';
import { withTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';

/** The credits icon, the same on Free and Pay as you go (round 176, John). */
export const CREDITS_ICON = 'ticket.fill' as const;

/**
 * Credits on the Search tab's top bar for Free and Pay as you go (round 176); Premium has none.
 * A tap opens the credits sheet.
 */
export function CreditsChip({ onAnswerLoads }: { onAnswerLoads: () => void }) {
  const c = useColors();
  const m = useMembership();
  const [open, setOpen] = useState(false);
  if (!m.tracksCredits || !m.tier) return null;
  return (
    <>
      <Pressable
        testID="credits-chip"
        onPress={withTick(() => setOpen(true))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={creditsWord(m.credits)}
        accessibilityHint="Opens your credits"
        style={pressStyle([styles.chip, { backgroundColor: c.accentSoft }])}>
        <Icon name={CREDITS_ICON} size={15} tintColor={c.accent} fallback={null} />
        <Text style={[styles.chipText, { color: c.accent }]} testID="credits-chip-count">
          {m.credits}
        </Text>
      </Pressable>
      <CreditsSheet
        visible={open}
        tier={m.tier}
        wallet={m.wallet}
        onClose={() => setOpen(false)}
        onAnswerLoads={() => {
          setOpen(false);
          onAnswerLoads();
        }}
      />
    </>
  );
}

/** Balance, what you've earned and spent, how credits work, and what happened lately. */
export function CreditsSheet({
  visible,
  tier,
  wallet,
  onClose,
  onAnswerLoads,
  now = Date.now(),
}: {
  visible: boolean;
  tier: Tier;
  wallet: Wallet;
  onClose: () => void;
  onAnswerLoads: () => void;
  now?: number;
}) {
  const c = useColors();
  const card = useCardSurface();
  const total = balance(wallet);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']} testID="credits-sheet">
        <SheetHeader title="Credits" subtitle={`${TIER_LABEL[tier]} plan`} action="Done" onAction={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          <View style={[card, styles.balance]} accessible accessibilityLabel={`${creditsWord(total)} left`}>
            <Icon name={CREDITS_ICON} size={22} tintColor={c.accent} fallback={null} />
            <Text style={[styles.big, { color: c.text }]} testID="credits-balance">
              {total}
            </Text>
            <Text style={[textStyles.bodyStrong, { color: c.muted }]}>{total === 1 ? 'credit left' : 'credits left'}</Text>
          </View>
          <View style={styles.stats}>
            <Stat label="Earned" value={String(earnedTotal(wallet))} testID="credits-earned" />
            <Stat label="Spent" value={String(spentTotal(wallet))} testID="credits-spent" />
          </View>

          <View style={[card, styles.how]}>
            <Text style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
              How credits work
            </Text>
            <HowLine delta={`+${EARN_PER_ANSWER}`} text="Answer a load on a flight at your airline" />
            <HowLine delta={`−${REQUEST_COST}`} text="Request a route’s loads. They go to My Trips." />
            {tier === 'payg' ? (
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
                Adding credits comes later. For now you start with 10.
              </Text>
            ) : null}
          </View>

          {wallet.entries.length ? (
            <View style={[card, styles.history]} testID="credits-history">
              <Text style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
                Recent
              </Text>
              {wallet.entries.slice(0, 10).map((e) => (
                <View key={e.id} style={styles.entry} accessible accessibilityLabel={`${e.label}, ${deltaText(e.delta)}`}>
                  <View style={styles.entryText}>
                    <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
                      {e.label}
                    </Text>
                    <Text style={[textStyles.small, { color: c.muted }]}>{formatAge(e.at, now)}</Text>
                  </View>
                  <Text style={[styles.delta, { color: e.delta > 0 ? c.timeEarly : c.text }]}>{deltaText(e.delta)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Button label="Answer Loads" kind="secondary" icon="text.bubble" onPress={onAnswerLoads} />
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.footer, { color: c.muted }]}>
            Demo credits, kept on this phone. Nothing is charged.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  const c = useColors();
  const card = useCardSurface();
  return (
    <View style={[card, styles.stat]} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[textStyles.small, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: c.text }]} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

function HowLine({ delta, text }: { delta: string; text: string }) {
  const c = useColors();
  return (
    <View style={styles.entry}>
      <Text style={[styles.howDelta, { color: c.text }]}>{delta}</Text>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.entryText, { color: c.text }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 15, fontVariant: ['tabular-nums'] },
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  balance: { alignItems: 'center', gap: 2, paddingVertical: spacing.section },
  big: { fontFamily: fonts.mono, fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', gap: spacing.group },
  stat: { flex: 1, padding: spacing.rowX, gap: 2 },
  statValue: { fontFamily: fonts.mono, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  how: { padding: spacing.rowX, gap: spacing.group },
  history: { padding: spacing.rowX, gap: spacing.group },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  entryText: { flex: 1 },
  delta: { fontFamily: fonts.mono, fontSize: 16, fontVariant: ['tabular-nums'] },
  howDelta: { fontFamily: fonts.mono, fontSize: 16, width: 28, fontVariant: ['tabular-nums'] },
  footer: { textAlign: 'center' },
});
