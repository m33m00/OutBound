import { StyleSheet, Text, View } from 'react-native';

import type { SeatTier } from '@/engine';
import { fonts, useColors } from '@/theme';

import { Icon } from './Icon';
import { COUNT_ICON } from './MiniRoute';
import { TIER_BG, TIER_FG } from './tierColors';

/**
 * A reported load the way the route line shows seats (round 164): the seat icon and open seats,
 * a slash, the person icon and people listed, in one pill in the seat color.
 * Decorative: the row around it says the numbers to VoiceOver.
 */
export function SeatCountPill({
  open,
  listed,
  tier,
  testID = 'seat-count-pill',
}: {
  open: number;
  listed: number;
  tier: SeatTier;
  testID?: string;
}) {
  const c = useColors();
  const fg = c[TIER_FG[tier]];
  return (
    <View
      style={[styles.pill, { backgroundColor: c[TIER_BG[tier]] }]}
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Icon name={COUNT_ICON.seats} size={12} tintColor={fg} fallback={null} />
      <Text style={[styles.text, { color: fg }]} maxFontSizeMultiplier={1.4}>
        {String(open)}
      </Text>
      <Text style={[styles.text, { color: fg }]} maxFontSizeMultiplier={1.4}>
        /
      </Text>
      <Icon name={COUNT_ICON.listed} size={12} tintColor={fg} fallback={null} />
      <Text style={[styles.text, { color: fg }]} maxFontSizeMultiplier={1.4}>
        {String(listed)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  text: { fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 16 },
});
