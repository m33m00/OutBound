import type { SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, type AccessibilityState, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { boldTextOn, fonts, minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
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
      {label ? <Text lineBreakStrategyIOS="push-out" style={[textStyles.button, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** A pill's visible height; hitSlop makes up the rest of the 44pt tap target. */
export const PILL_HEIGHT = 36;
const PILL_SLOP = (minTapTarget - PILL_HEIGHT) / 2;

export interface PillButtonProps {
  /** Empty for an icon-only round button (the label still goes to VoiceOver). */
  label: string;
  onPress?: () => void;
  /** soft: tinted, for Back, Cancel and moving around. filled: the one action that finishes (Done). onDark: over the camera. */
  tone?: 'soft' | 'filled' | 'onDark';
  /** SF Symbol before the label, e.g. chevron.left for Back. */
  leading?: SFSymbol;
  /** SF Symbol after the label, e.g. chevron.right for a step forward. */
  trailing?: SFSymbol;
  /** Text shown where SF Symbols don't draw (Android), e.g. ‹. */
  fallback?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  /** Extra reach past the pill's edge, on top of what makes it 44pt tall. */
  hitSlop?: { left?: number; right?: number };
  /** Regular weight for a quiet action (iOS sets Cancel lighter than Done). */
  quiet?: boolean;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A small capsule button (design round 79, John 2026-11-01: "make that look like a button").
 * Every control that moves you back, forward, closes a sheet or steps through pages uses it,
 * so nothing that navigates is a bare word. 36pt tall, 44pt to tap.
 */
export function PillButton({
  label,
  onPress,
  tone = 'soft',
  leading,
  trailing,
  fallback,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  hitSlop,
  quiet,
  textStyle,
  style,
  testID,
}: PillButtonProps) {
  const c = useColors();
  const bg = tone === 'filled' ? c.accent : tone === 'onDark' ? 'rgba(255,255,255,0.2)' : c.accentSoft;
  const fg = tone === 'filled' ? c.onAccent : tone === 'onDark' ? '#ffffff' : c.accent;
  const iconOnly = !label;
  const icon = (name: SFSymbol) => (
    <Icon
      name={name}
      size={15}
      weight="semibold"
      tintColor={fg}
      fallback={fallback ? <Text style={[textStyles.bodyStrong, { color: fg }]}>{fallback}</Text> : null}
    />
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState ?? (disabled ? { disabled: true } : undefined)}
      hitSlop={{ top: PILL_SLOP, bottom: PILL_SLOP, left: hitSlop?.left ?? 0, right: hitSlop?.right ?? 0 }}
      testID={testID}
      style={pressStyle([
        styles.pill,
        iconOnly ? styles.pillIcon : leading ? styles.pillLeading : trailing ? styles.pillTrailing : null,
        { backgroundColor: bg, opacity: disabled ? 0.35 : 1 },
        style,
      ])}>
      {leading ? icon(leading) : null}
      {label ? (
        <Text
          lineBreakStrategyIOS="push-out"
          style={[textStyles.bodyStrong, quiet && { fontFamily: boldTextOn() ? fonts.body : fonts.bodyMedium }, { color: fg }, textStyle]}>
          {label}
        </Text>
      ) : null}
      {trailing ? icon(trailing) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: PILL_HEIGHT,
    minWidth: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillIcon: { paddingHorizontal: 0, width: PILL_HEIGHT },
  pillLeading: { paddingLeft: 10 },
  pillTrailing: { paddingRight: 10 },
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
