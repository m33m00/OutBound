import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { forSpeech } from '@/search/format';
import { spacing, textStyles, useColors } from '@/theme';

import { PillButton } from './Buttons';

import { useFocusOnMount } from './focusOnMount';
import { MetaLine } from './MetaLine';

/** Titles stop growing here so long words don't break mid-word. */
export const TITLE_MAX_SCALE = 1.6;
/** At this text size the action goes above the title instead of beside it. */
const STACK_AT_FONT_SCALE = 1.8;

export interface SheetHeaderProps {
  title: string;
  subtitle?: string;
  /** "Done" keeps what you did; "Cancel" leaves without a change. */
  action: 'Done' | 'Cancel' | 'Later';
  onAction: () => void;
  /** VoiceOver starts on the title (a page swapped in inside a sheet). */
  focusTitle?: boolean;
  /**
   * iOS's own sheet header: a grabber on top, then a smaller title centered on the same line as the action
   * (round 214, John on the airport picker: the big "To" "feels plain and almost touching the corner").
   */
  centered?: boolean;
}

/**
 * Header for every page sheet (design round 24): title on the left, Done or Cancel as a small
 * capsule on the right (round 79), so it never competes with the sheet's own buttons.
 */
export function SheetHeader({ title, subtitle, action, onAction, focusTitle = false, centered = false }: SheetHeaderProps) {
  const c = useColors();
  const titleRef = useFocusOnMount(focusTitle);
  const stacked = useWindowDimensions().fontScale >= STACK_AT_FONT_SCALE;
  if (centered && !subtitle) {
    return (
      <View style={styles.navWrap} testID="sheet-nav">
        <View style={[styles.grabber, { backgroundColor: c.line2 }]} testID="sheet-grabber" />
        <View style={[styles.nav, stacked && styles.navStacked]}>
          {/* Centered on the sheet, kept clear of the action on the right (and the same room on the left). */}
          <Text
            ref={titleRef}
            style={[textStyles.heading, styles.navTitle, stacked && styles.navTitleStacked, { color: c.text }]}
            accessibilityRole="header"
            numberOfLines={stacked ? 2 : 1}
            maxFontSizeMultiplier={TITLE_MAX_SCALE}>
            {title}
          </Text>
          <PillButton
            label={action}
            tone={action === 'Done' ? 'filled' : 'soft'}
            quiet={action === 'Cancel'}
            onPress={onAction}
            hitSlop={{ right: spacing.page }}
            style={stacked ? styles.actionStacked : undefined}
            testID="sheet-action"
          />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.header, stacked && styles.stacked]}>
      <View style={[styles.title, stacked && styles.titleStacked]}>
        <Text
          ref={titleRef}
          style={[textStyles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {title}
        </Text>
        {/* "DAL → PHX → LAX" is read "DAL to PHX to LAX". */}
        {subtitle ? (
          // Items set apart by space, not dots (round 123, John); read as one line.
          <View accessible accessibilityLabel={forSpeech(subtitle)} testID="sheet-subtitle">
            <MetaLine text={subtitle} textStyle={[textStyles.bodyStrong, { color: c.muted }]} />
          </View>
        ) : null}
      </View>
      {/* A real button (round 79): Done filled since it finishes, Cancel soft and lighter. */}
      <PillButton
        label={action}
        tone={action === 'Done' ? 'filled' : 'soft'}
        quiet={action === 'Cancel'}
        onPress={onAction}
        hitSlop={{ right: spacing.page }}
        style={stacked ? styles.actionStacked : undefined}
        testID="sheet-action"
      />
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
  navWrap: { paddingTop: 6, paddingBottom: spacing.group },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: spacing.group },
  nav: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  navTitle: { position: 'absolute', left: 96, right: 96, textAlign: 'center' },
  // Big text: the title takes its own line under the action instead of squeezing between.
  navStacked: { flexDirection: 'column-reverse', alignItems: 'stretch', gap: spacing.group },
  navTitleStacked: { position: 'relative', left: 0, right: 0 },
});
