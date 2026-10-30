import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { forSpeech } from '@/search/format';
import { boldTextOn, fonts, minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { useFocusOnMount } from './focusOnMount';
import { pressStyle } from './press';

/** Titles stop growing here so long words don't break mid-word. */
export const TITLE_MAX_SCALE = 1.6;
/** At this text size the action goes above the title instead of beside it. */
const STACK_AT_FONT_SCALE = 1.8;

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
  const stacked = useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
  return (
    <View style={[styles.header, stacked && styles.stacked]}>
      <View style={[styles.title, stacked && styles.titleStacked]}>
        <Text ref={titleRef} style={[textStyles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {title}
        </Text>
        {/* "DAL → PHX → LAX" is read "DAL to PHX to LAX". */}
        {subtitle ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.muted }]} accessibilityLabel={forSpeech(subtitle)}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={action}
        hitSlop={{ right: spacing.page }}
        style={pressStyle([styles.action, stacked && styles.actionStacked], 'link')}
        testID="sheet-action">
        {/* iOS sets Done bold and Cancel regular weight (a step lighter under Bold Text too). */}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, action === 'Cancel' && { fontFamily: boldTextOn() ? fonts.body : fonts.bodyMedium }, { color: c.accent }]}>{action}</Text>
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
  // Big text: Done/Cancel sits on its own line above the title, at the right.
  stacked: { flexDirection: 'column-reverse', alignItems: 'stretch' },
  title: { flex: 1, gap: 2 },
  titleStacked: { flex: 0 },
  actionStacked: { alignSelf: 'flex-end' },
  action: { minHeight: minTapTarget, justifyContent: 'center', paddingLeft: spacing.group },
});
