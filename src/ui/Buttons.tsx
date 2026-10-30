import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { Icon } from './Icon';
import { pressStyle } from './press';

interface ButtonProps {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Say why a button is off, or what it opens. */
  accessibilityHint?: string;
  /** Decorative SF Symbol before the label (iOS; Android shows the label only). */
  icon?: SFSymbol;
  style?: StyleProp<ViewStyle>;
}

/** Title Case labels (DECISIONS.md: Find Routes, Get Home). */
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  accessibilityLabel,
  accessibilityHint,
  icon,
  style,
}: ButtonProps) {
  const c = useColors();
  const primary = kind === 'primary';
  const fg = primary ? c.onAccent : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={pressStyle([
        styles.button,
        { backgroundColor: primary ? c.accent : c.surface2, opacity: disabled ? 0.5 : 1 },
        style,
      ])}>
      {icon ? <Icon name={icon} size={18} tintColor={fg} fallback={null} /> : null}
      {label ? <Text style={[textStyles.button, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.page,
    // Two-line labels at big text keep clear of the edges.
    paddingVertical: 10,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
