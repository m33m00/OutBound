import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { pressStyle } from './press';

/** Radar on/off map button (44pt) with its age caption (Q-032). */
export function RadarButton({ on, caption, onToggle }: { on: boolean; caption: string | null; onToggle: () => void }) {
  const c = useColors();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityLabel="Radar"
        accessibilityState={{ checked: on }}
        accessibilityHint={caption ?? undefined}
        style={pressStyle([
          styles.button,
          { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.line2, shadowColor: c.text },
        ])}>
        <SymbolView
          name="cloud.rain"
          size={20}
          tintColor={on ? c.onAccent : c.text}
          fallback={<Text style={[textStyles.small, { color: on ? c.onAccent : c.text }]}>Rain</Text>}
        />
      </Pressable>
      {caption ? (
        <View style={[styles.caption, { backgroundColor: c.surface }]} pointerEvents="none" importantForAccessibility="no">
          <Text style={[textStyles.small, { color: c.muted }]}>{caption}</Text>
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
