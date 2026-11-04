import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Appear } from './Appear';
import { selectionTick } from './haptics';
import { Icon } from './Icon';
import { pressStyle } from './press';

/** How long "Saved · Undo" stays after a swipe save (round 138). */
export const SAVED_TOAST_MS = 5000;

/**
 * "Saved to My Trips · Undo" after a swipe-to-save (round 138, John: "I did accidentally save a couple flights
 * that I didn't mean to save"). Floats at the bottom of the route card for a few seconds; Undo takes the route
 * back out of My Trips. Gone on its own after SAVED_TOAST_MS, or as soon as `onDone` is called.
 */
export function SavedToast({ onUndo, onDone }: { onUndo: () => void; onDone: () => void }) {
  const c = useColors();
  useEffect(() => {
    const t = setTimeout(onDone, SAVED_TOAST_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <View pointerEvents="box-none" style={styles.wrap} testID="saved-toast">
      <Appear>
        <View style={[styles.toast, elevation.raised, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="bookmark.fill" size={15} tintColor={c.muted} fallback={null} />
          <Text style={[textStyles.bodyStrong, styles.words, { color: c.text }]}>Saved to My Trips</Text>
          <Pressable
            onPress={() => {
              selectionTick();
              onUndo();
              onDone();
              AccessibilityInfo.announceForAccessibility('Removed from My Trips');
            }}
            accessibilityRole="button"
            accessibilityLabel="Undo save"
            hitSlop={8}
            testID="saved-toast-undo"
            style={pressStyle([styles.undo, { borderColor: c.accent }])}>
            <Text style={[textStyles.bodyStrong, { color: c.accent }]}>Undo</Text>
          </Pressable>
        </View>
      </Appear>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.page, right: spacing.page, bottom: spacing.page, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    paddingLeft: spacing.section,
    paddingRight: 6,
    minHeight: minTapTarget,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  words: { flexShrink: 1 },
  undo: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
});
