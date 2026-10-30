import { Pressable, StyleSheet, Text } from 'react-native';

import type { RouteImpact } from '@/live';
import { impactBadgeText } from '@/search/impactText';
import { fonts, radius, textStyles, useColors } from '@/theme';
import { Icon } from './Icon';
import { pressStyle } from './press';

/**
 * Delay/weather badge for a result row (Q-001: equal to the seat tier).
 * Words plus color plus icon, so color is never the only signal.
 */
export const IMPACT_ICON = { caution: 'exclamationmark.circle', likelyDelays: 'exclamationmark.triangle.fill' } as const;

export function ImpactBadge({ impact, onPress }: { impact: RouteImpact; onPress: () => void }) {
  const c = useColors();
  if (impact.level === 'none') return null;
  const likely = impact.level === 'likelyDelays';
  const fg = likely ? c.likelyDelays : c.caution;
  const bg = likely ? c.likelyDelaysBg : c.cautionBg;
  return (
    <Pressable
      onPress={onPress}
      // Pill is ~22pt tall; slop brings the target to 44pt (DECISIONS: tap targets >=44pt).
      hitSlop={{ top: 11, bottom: 11, left: 10, right: 10 }}
      // The row is one VoiceOver element; it exposes this as a custom action.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={pressStyle([styles.pill, { backgroundColor: bg }])}>
      <Icon
        name={IMPACT_ICON[impact.level]}
        size={12}
        tintColor={fg}
        fallback={<Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: fg }]}>!</Text>}
      />
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.word, { fontFamily: fonts.bodySemiBold, color: fg }]} testID="impact-word">
        {impactBadgeText(impact)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 22,
    flexShrink: 1,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  // Shrinks so long words wrap inside the pill at big text sizes instead of spilling out.
  word: { flexShrink: 1 },
});
