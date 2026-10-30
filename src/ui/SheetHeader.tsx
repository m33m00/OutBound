import { Pressable, StyleSheet, Text, View } from 'react-native';

import { forSpeech } from '@/search/format';
import { fonts, minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { useFocusOnMount } from './focusOnMount';
import { pressStyle } from './press';

export interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  /** "Done" keeps what you did; "Cancel" leaves without a change. */
  action: 'Done' | 'Cancel';
  onAction: () => void;
  /** VoiceOver starts on the title (a page swapped in inside a sheet). */
  focusTitle?: boolean;
}

/**
 * Header for every page sheet (design round 24): title on the left, an iOS-style text
 * button on the right, so Done/Cancel never competes with the sheet's own buttons.
 */
export function SheetHeader({ title, subtitle, action, onAction, focusTitle = false }: SheetHeaderProps) {
  const c = useColors();
  const titleRef = useFocusOnMount(focusTitle);
  return (
    <View style={styles.header}>
      <View style={styles.title}>
        <Text ref={titleRef} style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
        {/* "DAL → PHX → LAX" is read "DAL to PHX to LAX". */}
        {subtitle ? (
          <Text style={[textStyles.bodyStrong, { color: c.muted }]} accessibilityLabel={forSpeech(subtitle)}>
            {subtitle}
          </Text>
        ) : null}
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
