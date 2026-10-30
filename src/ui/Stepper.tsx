import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { pressStyle } from './press';

/** Minus / value / plus row with 44pt buttons. Values in minutes by default. */
export function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
  format = formatDuration,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const c = useColors();
  const btn = (sign: 1 | -1) => {
    const next = value + sign * step;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={() => onChange(next)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${sign > 0 ? 'Increase' : 'Decrease'}: ${label}`}
        accessibilityValue={{ text: format(value) }}
        accessibilityState={{ disabled }}
        style={pressStyle([styles.stepBtn, { backgroundColor: c.surface2, opacity: disabled ? 0.4 : 1 }])}>
        <Text style={[textStyles.heading, { color: c.text }]}>{sign > 0 ? '+' : '−'}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.row}>
      <Text style={[textStyles.body, styles.label, { color: c.text }]}>{label}</Text>
      {btn(-1)}
      <Text style={[textStyles.bodyStrong, styles.value, { color: c.text }]} accessibilityLiveRegion="polite">
        {format(value)}
      </Text>
      {btn(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget },
  label: { flex: 1 },
  value: { minWidth: 64, textAlign: 'center' },
  stepBtn: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
