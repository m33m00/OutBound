import { Pressable, StyleSheet, Text } from 'react-native';

import type { RouteImpact } from '@/live';
import { impactAge, IMPACT_WORD } from '@/search/impactText';
import { fonts, radius, textStyles, useColors } from '@/theme';
import { Icon } from './Icon';
import { pressStyle } from './press';

/**
 * Delay/weather badge for a result row (Q-001: equal to the seat tier).
 * Words plus color plus icon, so color is never the only signal.
 */
export const IMPACT_ICON = { caution: 'exclamationmark.circle', likelyDelays: 'exclamationmark.triangle.fill' } as const;

export function ImpactBadge({ impact, now, onPress }: { impact: RouteImpact; now: number; onPress: () => void }) {
  const c = useColors();
  if (impact.level === 'none') return null;
  const likely = impact.level === 'likelyDelays';
  const fg = likely ? c.likelyDelays : c.caution;
  const bg = likely ? c.likelyDelaysBg : c.cautionBg;
  const age = impactAge(impact, now);
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
        fallback={<Text style={[textStyles.small, { color: fg }]}>!</Text>}
      />
      <Text style={[textStyles.small, styles.word, { color: fg }]}>
        {age ? `${IMPACT_WORD[impact.level]} · ${age}` : IMPACT_WORD[impact.level]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 22,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  word: { fontFamily: fonts.bodySemiBold },
});
