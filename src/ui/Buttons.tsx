import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Title Case labels (DECISIONS.md: Find Routes, Get Home). */
export function Button({ label, onPress, kind = 'primary', disabled, accessibilityLabel, style }: ButtonProps) {
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        { backgroundColor: primary ? c.accent : c.surface2, opacity: disabled ? 0.5 : 1 },
        style,
      ]}>
      <Text style={[textStyles.button, { color: primary ? c.onAccent : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.page,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
