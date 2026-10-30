import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { pressStyle } from './press';

export interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  /** "Done" keeps what you did; "Cancel" leaves without a change. */
  action: 'Done' | 'Cancel';
  onAction: () => void;
}

/**
 * Header for every page sheet (design round 24): title on the left, an iOS-style text
 * button on the right, so Done/Cancel never competes with the sheet's own buttons.
 */
export function SheetHeader({ title, subtitle, action, onAction }: SheetHeaderProps) {
  const c = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.title}>
        <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[textStyles.bodyStrong, { color: c.muted }]}>{subtitle}</Text> : null}
      </View>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={action}
        hitSlop={{ right: spacing.page }}
        style={pressStyle(styles.action, 'link')}
        testID="sheet-action">
        <Text style={[textStyles.heading, action === 'Cancel' && styles.cancel, { color: c.accent }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.section,
    gap: spacing.group,
  },
  title: { flex: 1, gap: 2 },
  action: { minHeight: minTapTarget, justifyContent: 'center', paddingLeft: spacing.group },
  // iOS sets Done bold and Cancel regular weight.
  cancel: { fontFamily: fonts.bodyMedium },
});
