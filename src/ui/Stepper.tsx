import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { formatDuration } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { pressStyle } from './press';
import { withTick } from './haptics';

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
  // From 1.3x text the label gets its own line, like ListRow, so it never breaks into a narrow column.
  const stacked = useWindowDimensions().fontScale >= STACK_SCALE;
  const btn = (sign: 1 | -1) => {
    const next = value + sign * step;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={withTick(() => onChange(next))}
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
  const controls = (
    <>
      {btn(-1)}
      <Text style={[textStyles.bodyStrong, styles.value, { color: c.text }]} accessibilityLiveRegion="polite">
        {format(value)}
      </Text>
      {btn(1)}
    </>
  );
  if (stacked) {
    return (
      <View style={styles.stack}>
        <Text style={[textStyles.body, { color: c.text }]}>{label}</Text>
        <View style={styles.row} testID="stepper-row">{controls}</View>
      </View>
    );
  }
  return (
    <View style={styles.row} testID="stepper-row">
      <Text style={[textStyles.body, styles.label, { color: c.text }]}>{label}</Text>
      {controls}
    </View>
  );
}

/** Same threshold as ListRow's stacked value. */
const STACK_SCALE = 1.3;

const styles = StyleSheet.create({
  stack: { gap: 4 },
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
