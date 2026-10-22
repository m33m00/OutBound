import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ResultsBanner as Banner } from '@/search/statusTags';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

/**
 * Discreet notice under Find Routes when a search shows nothing (Q-047):
 * "No Flights Found on Selected Date" or "{N} routes hidden by your
 * filters · Show Them". No results panel opens for these.
 */
export function ResultsBanner({
  banner,
  onShow,
  onDismiss,
}: {
  banner: Banner;
  onShow: () => void;
  onDismiss: () => void;
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
        <Text style={[textStyles.body, { color: c.text }]}>
          {banner.text}
          {banner.kind === 'hidden' ? ' ·' : ''}
        </Text>
        {banner.kind === 'hidden' ? (
          <Pressable
            onPress={onShow}
            accessibilityRole="button"
            accessibilityLabel={banner.action}
            accessibilityHint="Shows the hidden routes for this search only. Your filters stay the same."
            style={styles.link}>
            <Text style={[textStyles.bodyStrong, { color: c.accent }]}>{banner.action}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss notice" style={styles.close}>
        <SymbolView
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
    borderRadius: radius.md,
    borderWidth: 1,
    paddingLeft: spacing.rowX,
    paddingVertical: 4,
  },
  message: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.group },
  link: { minHeight: minTapTarget, justifyContent: 'center' },
  close: { width: minTapTarget, height: minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
