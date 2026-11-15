import type { SFSymbol } from 'expo-symbols';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { forSpeech } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { ROUTE_ARROW, trails } from './TrailMark';
import { Glass } from './Glass';

/** From this text size a row's value goes under its label. */
const STACK_VALUE_SCALE = 1.3;

/** Small uppercase heading above a grouped card (iOS Settings style). */
export function SectionHeader({ title }: { title: string }) {
  const c = useColors();
  return (
    <Text
      lineBreakStrategyIOS="push-out"
      style={[textStyles.small, styles.title, { color: c.muted }]}
      accessibilityRole="header"
      accessibilityLabel={title.includes(ROUTE_ARROW) ? forSpeech(title) : undefined}>
      {/* A route in the heading shows the plane and contrail (round 209, John). */}
      {trails(title.toUpperCase(), textStyles.small.fontSize)}
    </Text>
  );
}

/** Explanation under a grouped card. */
export function SectionFooter({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.footer, { color: c.muted }]}>
      {children}
    </Text>
  );
}

/**
 * Grouped list card (iOS Settings style): optional heading above, rows
 * separated by hairlines inset to the text.
 */
export function ListGroup({
  title,
  children,
  plain = false,
}: {
  title?: string;
  children: ReactNode;
  /** Rows straight on the page with hairlines between, no card around them (round 216, the Requests tab). */
  plain?: boolean;
}) {
  const c = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  if (plain) {
    return (
      <View style={styles.wrap} testID="list-group-plain">
        {title ? <SectionHeader title={title} /> : null}
        <View>
          {rows.map((row, i) => (
            <Fragment key={i}>
              {i > 0 ? <View style={[styles.sep, styles.sepPlain, { backgroundColor: c.line }]} /> : null}
              {row}
            </Fragment>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {title ? <SectionHeader title={title} /> : null}
      {/* The shared card look (round 163); the inner view clips a pressed row's corners without clipping the lift. */}
      <Glass testID="list-group-card">
        <View style={styles.clip}>
          {rows.map((row, i) => (
            <Fragment key={i}>
              {/* Under a row with an icon tile, its hairline starts at the text, like iOS (round 166). */}
              {i > 0 ? (
                <View
                  style={[
                    styles.sep,
                    isValidElement<ListRowProps>(rows[i - 1]) && (rows[i - 1] as { props: ListRowProps }).props.icon
                      ? styles.sepIcon
                      : null,
                    { backgroundColor: c.line },
                  ]}
                />
              ) : null}
              {row}
            </Fragment>
          ))}
        </View>
      </Glass>
    </View>
  );
}

export interface ListRowProps {
  label: string;
  value?: string;
  /** Second line under the label. */
  detail?: string;
  /** Tappable row with a chevron when given. */
  onPress?: () => void;
  accessibilityHint?: string;
  /** The value is an action to take (accent), not a setting. */
  valueAccent?: boolean;
  /** A small icon tile before the label, like iOS Settings (round 166). Decorative. */
  icon?: SFSymbol;
}

/** One row: label (+ detail) on the left, value and chevron on the right. */
export function ListRow({ label, value, detail, onPress, accessibilityHint, valueAccent, icon }: ListRowProps) {
  const c = useColors();
  // Big text: the value goes under the label so neither gets cut off.
  const stacked = useWindowDimensions().fontScale >= STACK_VALUE_SCALE;
  const valueText = value ? (
    <Text
      style={[textStyles.body, !stacked && styles.value, { color: valueAccent ? c.accent : c.muted }]}
      numberOfLines={stacked ? undefined : 2}>
      {value}
    </Text>
  ) : null;
  const content = (
    <>
      {icon ? (
        <View style={styles.iconTile} testID="list-row-icon">
          <Icon name={icon} size={17} tintColor={c.muted} fallback={null} />
        </View>
      ) : null}
      <View style={styles.left}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {label}
        </Text>
        {stacked ? valueText : null}
        {detail ? (
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {stacked ? null : valueText}
      {onPress ? (
        <Icon
          name="chevron.right"
          size={13}
          weight="semibold"
          tintColor={c.faint}
          fallback={<Text style={[textStyles.heading, { color: c.faint }]}>›</Text>}
        />
      ) : null}
    </>
  );
  const a11yLabel = [label, value, detail].filter(Boolean).join(', ');
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: c.surface2 } : null]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.group },
  title: { paddingHorizontal: spacing.rowX, letterSpacing: 0.6 },
  footer: { paddingHorizontal: spacing.rowX },
  clip: { borderRadius: radius.all - 1, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.rowX },
  // On the page, a row's hairline starts at its text, past the airline badge (round 216).
  sepPlain: { marginLeft: spacing.rowX + 30 + spacing.section },
  // rowX + the 30pt tile + its 2pt margin + the row gap.
  sepIcon: { marginLeft: spacing.rowX + 32 + spacing.group },
  row: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    paddingVertical: spacing.rowY,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
  },
  left: { flex: 1, gap: 2 },
  // A plain icon, no tinted tile (round 207).
  iconTile: { width: 24, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  value: { flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
});
