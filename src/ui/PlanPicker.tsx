import type { SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { creditsWord, TIER_LABEL, TIER_PITCH, TIERS, WELCOME_CREDITS, type Tier } from '@/membership/membership';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { useCardSurface } from './cardSurface';
import { withTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';

export const TIER_ICON: Record<Tier, SFSymbol> = {
  free: 'person.fill',
  payg: 'creditcard.fill',
  premium: 'star.fill',
};

/** What each plan starts with, under its pitch. */
export function tierStart(tier: Tier): string {
  if (tier === 'premium') return 'Unlimited loads';
  return `Starts with ${creditsWord(WELCOME_CREDITS[tier])}`;
}

/** The three plans as cards to pick from; the picked one has a blue outline and a check. */
export function PlanChoices({ value, onChange }: { value: Tier | null; onChange: (tier: Tier) => void }) {
  const c = useColors();
  const card = useCardSurface();
  return (
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="Plan">
      {TIERS.map((tier) => {
        const on = value === tier;
        return (
          <Pressable
            key={tier}
            testID={`plan-${tier}`}
            onPress={withTick(() => onChange(tier))}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${TIER_LABEL[tier]}. ${TIER_PITCH[tier]} ${tierStart(tier)}.`}
            style={pressStyle([card, styles.choice, { borderColor: on ? c.accent : c.cardEdge, borderWidth: on ? 2 : 1 }])}>
            <View style={[styles.iconTile, { backgroundColor: c.accentSoft }]}>
              <Icon name={TIER_ICON[tier]} size={18} tintColor={c.accent} fallback={null} />
            </View>
            <View style={styles.choiceText}>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
                {TIER_LABEL[tier]}
              </Text>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
                {TIER_PITCH[tier]}
              </Text>
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.text }]} testID={`plan-${tier}-start`}>
                {tierStart(tier)}
              </Text>
            </View>
            <View
              style={[styles.radio, { borderColor: on ? c.accent : c.line2, backgroundColor: on ? c.accent : 'transparent' }]}
              testID={on ? 'plan-picked' : undefined}>
              {on ? <Icon name="checkmark" size={12} tintColor={c.onAccent} fallback={null} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Asks which plan you have (round 176, John: "Add a prompt to the main menu"). Shows on the
 * Search tab until a plan is picked; a swipe down asks again next launch. A demo: nothing is charged.
 */
export function PlanPicker({
  visible,
  onPick,
  onLater,
}: {
  visible: boolean;
  onPick: (tier: Tier) => void;
  onLater: () => void;
}) {
  const c = useColors();
  const [choice, setChoice] = useState<Tier | null>(null);
  useEffect(() => {
    if (visible) setChoice(null);
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onLater}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']} testID="plan-picker">
        <SheetHeader title="Pick your plan" subtitle="How you see loads" action="Later" onAction={onLater} focusTitle />
        <ScrollView contentContainerStyle={styles.body}>
          <PlanChoices value={choice} onChange={setChoice} />
          <Button
            label="Continue"
            disabled={!choice}
            onPress={() => {
              if (choice) onPick(choice);
            }}
          />
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.footer, { color: c.muted }]}>
            This is a demo, so nothing is charged. Change your plan any time in Settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  choices: { gap: spacing.group },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, padding: spacing.rowX, borderRadius: radius.md },
  choiceText: { flex: 1, gap: 2 },
  iconTile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { textAlign: 'center' },
});
