import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ResultsBanner as Banner } from '@/search/statusTags';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { PillButton } from './Buttons';
import { Icon } from './Icon';
import { pressStyle } from './press';

/**
 * Discreet notice under Find Routes when a search shows nothing (Q-047):
 * "No Flights Found on Selected Date" or "{N} routes hidden by your
 * filters · Show Them". No results panel opens for these. A day with no
 * flights offers the next day in one tap (Q-073, John, 2026-10-30).
 */
export function ResultsBanner({
  banner,
  onShow,
  onDismiss,
  next,
}: {
  banner: Banner;
  onShow: () => void;
  onDismiss: () => void;
  /** No flights: search the next day ("Try Tomorrow"). Left out on the last searchable day. */
  next?: { label: string; hint: string; onPress: () => void } | null;
}) {
  const c = useColors();
  // One announcement (works on iOS and Android); no live region, so it isn't read twice.
  const spoken = `${banner.text}.`;
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(spoken);
  }, [spoken]);
  return (
    <View style={[styles.banner, { backgroundColor: c.surface2, borderColor: c.line }]}>
      <View style={styles.message}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {banner.text}
        </Text>
        {banner.kind === 'noFlights' && next ? (
          <PillButton
            label={next.label}
            trailing="chevron.right"
            onPress={next.onPress}
            accessibilityHint={next.hint}
            style={styles.link}
          />
        ) : null}
        {banner.kind === 'hidden' ? (
          <PillButton
            label={banner.action}
            onPress={onShow}
            accessibilityHint="Shows the hidden routes for this search only. Your filters stay the same."
            style={styles.link}
          />
        ) : null}
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notice"
        style={pressStyle(styles.close, 'link')}>
        <Icon
          name="xmark"
          size={14}
          weight="semibold"
          tintColor={c.muted}
          fallback={<Text style={[textStyles.bodyStrong, { color: c.muted }]}>×</Text>}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.all,
    borderWidth: 1,
    paddingLeft: spacing.rowX,
    paddingVertical: 4,
  },
  message: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.group },
  link: { alignSelf: 'flex-start' },
  close: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
