import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';

/**
 * A section's own header in My Trips (round 167, John: "Your Requests and Saved Routes should have a better
 * design to separate both"): an icon in a circle, the name in heading size, how many, and the section's action
 * on the right. Sections after the first get a rule above them.
 */
export function TripsSectionHeader({
  icon,
  title,
  count,
  action,
  rule,
  testID,
}: {
  icon: SFSymbol;
  title: string;
  count?: number;
  action?: ReactNode;
  /** A hairline above, splitting this section from the one before. */
  rule?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <View style={[styles.wrap, rule && [styles.rule, { borderTopColor: c.line }]]} testID={testID}>
      <View style={[styles.icon, { backgroundColor: c.surface2 }]}>
        <Icon name={icon} size={16} tintColor={c.text} fallback={null} />
      </View>
      <View
        style={styles.titleLine}
        accessible
        accessibilityRole="header"
        accessibilityLabel={count != null ? `${title}, ${count}` : title}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, styles.title, { color: c.text }]}>
          {title}
        </Text>
        {count != null ? (
          <View style={[styles.count, { backgroundColor: c.surface2 }]}>
            <Text style={[styles.countText, { color: c.muted }]} maxFontSizeMultiplier={1.4}>
              {String(count)}
            </Text>
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: 44 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.page, marginTop: spacing.group },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  titleLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  title: { fontSize: 20, lineHeight: 26, flexShrink: 1 },
  count: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignItems: 'center' },
  countText: { fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 17 },
});
