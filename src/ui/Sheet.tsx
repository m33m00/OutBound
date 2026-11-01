import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { minTapTarget, radius, useColors } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

const SNAP_NAMES = ['Peek', 'Half', 'Full'];
/**
 * Critically damped, no bounce, never past the snap: the panel settles like an iOS sheet. It
 * starts at the finger's release speed, so a hard flick carries on instead of stopping and
 * restarting (John, 2026-11-01).
 */
export const SNAP_SPRING = {
  useNativeDriver: true,
  stiffness: 420,
  damping: 42,
  mass: 1,
  overshootClamping: true,
} as const;
/** Release speed (pt/s) from which a drag counts as a flick. */
export const FLICK_SPEED = 500;

/**
 * Where a drag lands. A flick goes to the next size in its direction, never back and never two
 * sizes at once; a slow drag lands on the size nearest where it would coast to.
 */
export function pickSnap(snaps: readonly number[], visible: number, velocityY: number): number {
  if (Math.abs(velocityY) >= FLICK_SPEED) {
    const up = velocityY < 0;
    const order = snaps.map((s, i) => ({ s, i }));
    const next = up ? order.find((o) => o.s > visible + 1) : [...order].reverse().find((o) => o.s < visible - 1);
    if (next) return next.i;
    return up ? snaps.length - 1 : 0;
  }
  const projected = visible - velocityY * 0.12;
  let best = 0;
  snaps.forEach((s, i) => {
    if (Math.abs(s - projected) < Math.abs(snaps[best] - projected)) best = i;
  });
  return best;
}

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
 *
 * The panel is always laid out at full height and slid down to show the size you're at, so
 * dragging and settling only move it (on the native driver) and never re-lay out what's inside
 * each frame (John, 2026-11-01: hard drags felt clunky). The space below the visible part is
 * padded off once it settles, so lists still scroll to their end.
 */
export function Sheet({ snaps, index, onIndexChange, children }: SheetProps) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const full = snaps[snaps.length - 1];
  const fullRef = useRef(full);
  fullRef.current = full;
  // Slide down from full: offset = full - visible height.
  const offset = useRef(new Animated.Value(full - snaps[index])).current;
  // The visible height when nothing moves, and the one a running settle is heading to.
  const visible = useRef(snaps[index]);
  const heading = useRef<number | null>(null);
  const dragStart = useRef(0);
  const dragReady = useRef(true);
  const lastFull = useRef(full);
  // Content keeps the settled height; it only grows to full while a drag or a growing settle runs.
  const [restHeight, setRestHeight] = useState(snaps[index]);

  const settle = useCallback(
    (to: number, velocityY = 0) => {
      heading.current = to;
      if (to > visible.current) setRestHeight(fullRef.current);
      const done = () => {
        visible.current = to;
        heading.current = null;
        setRestHeight(to);
      };
      if (reduceMotion) {
        offset.setValue(fullRef.current - to);
        return done();
      }
      Animated.spring(offset, {
        toValue: fullRef.current - to,
        velocity: velocityY,
        ...SNAP_SPRING,
      }).start(({ finished }) => {
        if (finished) done();
      });
    },
    [offset, reduceMotion],
  );

  // One motion for every snap, from a tap, a drag or the app (design round 29). A size the panel
  // is already heading to is left alone, so a flick's settle never restarts from a stop.
  useEffect(() => {
    const to = snaps[index];
    // The panel's full height changed (layout): keep the same visible height under the new frame.
    if (lastFull.current !== full) {
      lastFull.current = full;
      offset.setValue(full - visible.current);
    }
    if (heading.current === to) return;
    if (heading.current == null && Math.abs(visible.current - to) < 0.5) {
      offset.setValue(full - to);
      setRestHeight(to);
      return;
    }
    settle(to);
  }, [index, snaps, full, offset, settle]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      setRestHeight(fullRef.current);
      const moving = heading.current != null;
      heading.current = null;
      dragReady.current = !moving;
      dragStart.current = visible.current;
      // Mid-settle, the native side knows where the panel is; the drag starts from there.
      offset.stopAnimation((value) => {
        if (dragReady.current) return;
        visible.current = fullRef.current - value;
        dragStart.current = visible.current;
        dragReady.current = true;
      });
    })
    .onUpdate((e) => {
      if (!dragReady.current) return;
      const h = Math.max(snaps[0], Math.min(full, dragStart.current - e.translationY));
      visible.current = h;
      offset.setValue(full - h);
    })
    .onEnd((e) => {
      const best = pickSnap(snaps, visible.current, e.velocityY);
      // Start the settle here with the release speed; a new size only tells the screen.
      settle(snaps[best], e.velocityY);
      if (best !== index) onIndexChange(best);
    });

  return (
    // Clips the slid-down part so it never draws over the tab bar.
    <View style={styles.clip} pointerEvents="box-none">
      <Animated.View
        testID="sheet"
        style={[
          styles.sheet,
          {
            height: full,
            transform: [{ translateY: offset }],
            backgroundColor: c.surface,
            borderColor: c.line,
            shadowColor: c.text,
          },
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
        <View style={[styles.body, { paddingBottom: Math.max(0, full - restHeight) }]} testID="sheet-body">
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
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
