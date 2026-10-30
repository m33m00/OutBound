import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, textStyles, useColors } from '@/theme';

export interface EmptyStateProps {
  /** Decorative SF Symbol (iOS; Android shows none). */
  icon: SFSymbol;
  title: string;
  body: string;
  /** Short lines on what will show here, shown as a list. */
  points?: readonly string[];
  /** Optional action under the text (e.g. a button). */
  action?: ReactNode;
}

/**
 * A tab or list with nothing in it yet: icon, one heading, one sentence and
 * an optional list of what's coming. Reads as one VoiceOver element so the
 * whole explanation is heard at once; the action stays separately reachable.
 */
export function EmptyState({ icon, title, body, points, action }: EmptyStateProps) {
  const c = useColors();
  const label = [title, body, ...(points ?? [])].map((t) => t.replace(/[.\s]+$/, '')).join('. ');
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View accessible accessibilityLabel={label} style={styles.text}>
        <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
          <SymbolView name={icon} size={26} tintColor={c.accent} fallback={null} />
        </View>
        <Text style={[textStyles.heading, styles.center, { color: c.text }]}>{title}</Text>
        <Text style={[textStyles.body, styles.center, { color: c.muted }]}>{body}</Text>
        {points?.length ? (
          <View style={styles.points}>
            {points.map((point) => (
              <View key={point} style={styles.point}>
                <View style={[styles.dot, { backgroundColor: c.accent }]} />
                <Text style={[textStyles.body, styles.pointText, { color: c.text }]}>{point}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const ICON = 56;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.page * 1.5,
    gap: spacing.page,
  },
  text: { alignItems: 'center', gap: spacing.group },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
  points: { alignSelf: 'stretch', gap: spacing.group, marginTop: spacing.group },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.group + 2 },
  // Centered on the first line of body text (20pt line height).
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  pointText: { flex: 1 },
});
