import { SymbolView } from 'expo-symbols';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

/**
 * Grouped list card (iOS Settings style): optional heading above, rows
 * separated by hairlines inset to the text.
 */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const c = useColors();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.wrap}>
      {title ? (
        <Text style={[textStyles.small, styles.title, { color: c.muted }]} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.sep, { backgroundColor: c.line }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
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
}

/** One row: label (+ detail) on the left, value and chevron on the right. */
export function ListRow({ label, value, detail, onPress, accessibilityHint }: ListRowProps) {
  const c = useColors();
  const content = (
    <>
      <View style={styles.left}>
        <Text style={[textStyles.body, { color: c.text }]}>{label}</Text>
        {detail ? <Text style={[textStyles.small, { color: c.muted }]}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text style={[textStyles.bodyStrong, styles.value, { color: c.muted }]} numberOfLines={2}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <SymbolView
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
  wrap: { gap: 6 },
  title: { paddingHorizontal: spacing.rowX, letterSpacing: 0.6 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.rowX },
  row: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    paddingVertical: spacing.rowY,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
  },
  left: { flex: 1, gap: 2 },
  value: { flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
});
