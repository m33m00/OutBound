import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { minTapTarget, radius, useColors } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

const SNAP_NAMES = ['Peek', 'Half', 'Full'];
/** Critically damped, no bounce: the panel settles like an iOS sheet. */
export const SNAP_SPRING = { useNativeDriver: false, bounciness: 0, speed: 16 } as const;

export interface SheetProps {
  /** Visible heights in pt, ascending: peek, half, full. */
  snaps: readonly number[];
  index: number;
  onIndexChange: (index: number) => void;
  children: ReactNode;
}

/**
 * Bottom panel over the globe (prototype layout). Drag the handle to resize;
 * tapping the handle steps through sizes so it works without a gesture.
 */
export function Sheet({ snaps, index, onIndexChange, children }: SheetProps) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const height = useRef(new Animated.Value(snaps[index])).current;
  const current = useRef(snaps[index]);
  const dragStart = useRef(0);

  useEffect(() => {
    const id = height.addListener(({ value }) => (current.current = value));
    return () => height.removeListener(id);
  }, [height]);

  // One motion for every snap, from a tap, a drag or the app (design round 29); Reduce Motion jumps.
  const snapTo = useCallback(
    (to: number) => {
      if (reduceMotion) return height.setValue(to);
      Animated.spring(height, { toValue: to, ...SNAP_SPRING }).start();
    },
    [height, reduceMotion],
  );

  useEffect(() => {
    snapTo(snaps[index]);
  }, [index, snaps, snapTo]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      height.stopAnimation();
      dragStart.current = current.current;
    })
    .onUpdate((e) => {
      const h = dragStart.current - e.translationY;
      height.setValue(Math.max(snaps[0], Math.min(snaps[snaps.length - 1], h)));
    })
    .onEnd((e) => {
      // Fling-aware: project a little along the release velocity.
      const projected = current.current - e.velocityY * 0.12;
      let best = 0;
      snaps.forEach((s, i) => {
        if (Math.abs(s - projected) < Math.abs(snaps[best] - projected)) best = i;
      });
      // Same size as before: settle back here (a new size animates from the effect above).
      if (best === index) snapTo(snaps[best]);
      else onIndexChange(best);
    });

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height, backgroundColor: c.surface, borderColor: c.line, shadowColor: c.text },
      ]}>
      <GestureDetector gesture={pan}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Results panel size"
          accessibilityValue={{ text: SNAP_NAMES[index] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
            onIndexChange(Math.max(0, Math.min(snaps.length - 1, index + step)));
          }}
          // Tap grows the panel a size; at full it steps back one size instead of
          // jumping to the smallest (drag or VoiceOver still reach it).
          onPress={() => onIndexChange(index >= snaps.length - 1 ? Math.max(0, snaps.length - 2) : index + 1)}
          style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: c.line2 }]} />
        </Pressable>
      </GestureDetector>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
    overflow: 'hidden',
  },
  handleArea: {
    height: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  body: {
    flex: 1,
  },
});
