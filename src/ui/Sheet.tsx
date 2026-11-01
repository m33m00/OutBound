import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

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

/**
 * The middle stop: about half the height (48%), or taller when the content needs it to show
 * in full (John, 2026-11-01), never as tall as the full stop. `need` 0 means not measured yet.
 */
export function halfSnap(height: number, need: number, full: number): number {
  return Math.min(full - 1, Math.max(Math.round(height * 0.48), Math.ceil(need)));
}

/** Height of the handle strip at the top of the panel. */
export const SHEET_HANDLE_H = minTapTarget;
/** Top strip of a locked panel: no handle, just room under the rounded corners. */
export const SHEET_LOCKED_TOP = 12;

export interface SheetProps {
  /**
   * Fixed at its size: no handle, no drag, no tap to resize (John, 2026-11-01: once a route is
   * picked the panel should stay put).
   */
  locked?: boolean;
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
 * The panel is always laid out at full height and slid down to show the size you're at (round 88).
 * Round 89 (John, 2026-11-01: still clunky on a hard drag): the finger's travel is mapped straight
 * to the slide on the native side (gesture handler's Animated event), so a drag never waits on the
 * JS thread; a flick settles from its release speed; and the screen hears the new size only once
 * the panel has stopped, so the map's re-framing never runs under the moving panel. Core Animated
 * and gesture handler only, both in Expo Go.
 */
export function Sheet({ snaps, index, onIndexChange, children, locked = false }: SheetProps) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const full = snaps[snaps.length - 1];
  const fullRef = useRef(full);
  fullRef.current = full;
  const maxOffset = full - snaps[0];
  // Where the panel rests (offset down from full height), moved by settles; and the finger's
  // travel, written straight from the gesture on the native side so a drag never waits on JS.
  const base = useRef(new Animated.Value(full - snaps[index])).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const baseNow = useRef(full - snaps[index]);
  // The visible height a running settle is heading to.
  const heading = useRef<number | null>(null);
  const lastFull = useRef(full);
  // Content keeps the settled height; it grows to full when a settle heads up.
  const [restHeight, setRestHeight] = useState(snaps[index]);
  const translateY = useMemo(
    () =>
      Animated.add(base, dragY).interpolate({
        inputRange: [0, Math.max(1, maxOffset)],
        outputRange: [0, Math.max(1, maxOffset)],
        extrapolate: 'clamp',
      }),
    [base, dragY, maxOffset],
  );

  const settle = useCallback(
    (to: number, velocityY = 0, then?: () => void) => {
      heading.current = to;
      if (fullRef.current - to < baseNow.current) setRestHeight(fullRef.current);
      const target = fullRef.current - to;
      const done = () => {
        baseNow.current = target;
        heading.current = null;
        setRestHeight(to);
        then?.();
      };
      if (reduceMotion) {
        base.setValue(target);
        return done();
      }
      Animated.spring(base, { toValue: target, velocity: velocityY, ...SNAP_SPRING }).start(({ finished }) => {
        if (finished) done();
      });
    },
    [base, reduceMotion],
  );

  // One motion for every snap, from a tap or the app (design round 29). A size the panel is
  // already at or heading to is left alone, so a flick's settle never restarts from a stop.
  useEffect(() => {
    const to = snaps[index];
    // The panel's full height changed (layout): keep the same visible height under the new frame.
    if (lastFull.current !== full) {
      baseNow.current += full - lastFull.current;
      lastFull.current = full;
      base.setValue(baseNow.current);
    }
    if (heading.current === to) return;
    if (heading.current == null && Math.abs(baseNow.current - (full - to)) < 0.5) {
      setRestHeight(to);
      return;
    }
    settle(to);
  }, [index, snaps, full, base, settle]);

  const indexRef = useRef(index);
  indexRef.current = index;
  const snapsRef = useRef(snaps);
  snapsRef.current = snaps;
  const pan = usePanGesture({
    enabled: !locked,
    useAnimated: true,
    activeOffsetY: [-4, 4],
    onUpdate: Animated.event([{ nativeEvent: { handlerData: { translationY: dragY } } }], { useNativeDriver: true }),
    onBegin: () => {
      // Catch a settle mid-way: the panel holds where it is and the drag carries on from there.
      if (heading.current == null) return;
      heading.current = null;
      base.stopAnimation((v) => {
        baseNow.current = v;
      });
    },
    onDeactivate: (e) => {
      const f = fullRef.current;
      const list = snapsRef.current;
      const offsetNow = Math.max(0, Math.min(f - list[0], baseNow.current + e.translationY));
      // Hand the finger's travel over to the resting position in one step, then settle from there.
      base.setValue(offsetNow);
      dragY.setValue(0);
      baseNow.current = offsetNow;
      const best = pickSnap(list, f - offsetNow, e.velocityY);
      // The screen hears the new size once the panel has stopped, so the map's re-framing and the
      // screen's re-render never run under the moving panel (John, 2026-11-01).
      settle(list[best], e.velocityY, () => {
        if (best !== indexRef.current) onIndexChange(best);
      });
    },
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
            transform: [{ translateY }],
            backgroundColor: c.surface,
            borderColor: c.line,
            shadowColor: c.text,
          },
        ]}>
        {locked ? (
          <View style={{ height: SHEET_LOCKED_TOP }} testID="sheet-locked-top" />
        ) : (
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
        )}
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
