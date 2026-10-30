import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { Icon } from './Icon';
import { pressStyle } from './press';
import { withTick } from './haptics';

/**
 * Radar on/off map button (44pt) with its age caption (Q-032). On but with
 * nothing drawn yet (loading, unavailable) it shows a light blue fill, so a
 * solid blue button always means rain is on the globe.
 */
export function RadarButton({
  on,
  caption,
  showing = on,
  onToggle,
}: {
  on: boolean;
  caption: string | null;
  showing?: boolean;
  onToggle: () => void;
}) {
  const c = useColors();
  const solid = on && showing;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={withTick(onToggle)}
        accessibilityRole="switch"
        accessibilityLabel="Radar"
        accessibilityState={{ checked: on }}
        // The caption is the state ("Radar 4 min ago", "Radar unavailable"), so it's the value, not a hint.
        accessibilityValue={caption ? { text: caption } : undefined}
        accessibilityHint={on ? undefined : 'Shows rain on the globe'}
        style={pressStyle([
          styles.button,
          {
            backgroundColor: solid ? c.accent : on ? c.accentSoft : c.surface,
            borderColor: on ? c.accent : c.line2,
            shadowColor: c.text,
          },
        ])}>
        <Icon
          name="cloud.rain"
          size={20}
          tintColor={solid ? c.onAccent : on ? c.accent : c.text}
          fallback={<Text style={[textStyles.small, { color: solid ? c.onAccent : on ? c.accent : c.text }]}>Rain</Text>}
        />
      </Pressable>
      {caption ? (
        <View style={[styles.caption, { backgroundColor: c.surface }]} pointerEvents="none"
          // Hidden from VoiceOver on both platforms; the button's hint already says it.
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: spacing.group, right: spacing.group, alignItems: 'flex-end', gap: 4 },
  button: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: minTapTarget / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  caption: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
});
