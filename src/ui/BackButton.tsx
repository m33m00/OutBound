import { Pressable, StyleSheet, Text } from 'react-native';

import { minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { pressStyle } from './press';

/** iOS-style back link: chevron + word, 44pt tall (design round 5). */
export function BackButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ left: spacing.page }}
      style={pressStyle(styles.back, 'link')}>
      <Icon
        name="chevron.left"
        size={17}
        weight="semibold"
        tintColor={c.accent}
        fallback={<Text style={[textStyles.heading, { color: c.accent }]}>‹</Text>}
      />
      {label ? <Text style={[textStyles.heading, { color: c.accent }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingRight: spacing.page,
  },
});
