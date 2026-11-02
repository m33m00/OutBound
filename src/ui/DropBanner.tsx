import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';

import { spacing, useColors } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

/** How far above its spot the banner starts, and how long it waits before it drops. */
export const DROP = { fromY: -140, delayMs: 350, dismissAt: -40, liftMs: 180 } as const;

/**
 * A banner that drops down from the top into the map area (John, 2026-11-02: "like a banner
 * dropping down into the map area"). It springs in once when it mounts; with Reduce Motion it is
 * just there. It sits over the globe, under the top bar, and reports its height so the globe can
 * keep what it centers on clear of it. With onDismiss, a swipe up past DROP.dismissAt lifts it away
 * (John, 2026-11-02: "swipe up to dismiss"); a shorter swipe springs it back.
 */
export function DropBanner({
  children,
  onHeight,
  onDismiss,
  testID = 'drop-banner',
}: {
  children: ReactNode;
  onHeight?: (height: number) => void;
  onDismiss?: () => void;
  testID?: string;
}) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      drop.stopAnimation();
      drop.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(DROP.delayMs),
      Animated.spring(drop, { toValue: 1, damping: 16, stiffness: 160, mass: 1, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [drop, reduceMotion]);
  // Finger drag up (never down past its spot).
  const drag = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => !!dismissRef.current && g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => drag.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy <= DROP.dismissAt || g.vy < -0.8) {
            if (reduceMotion) return dismissRef.current?.();
            Animated.timing(drag, { toValue: DROP.fromY * 1.5, duration: DROP.liftMs, useNativeDriver: true }).start(() =>
              dismissRef.current?.(),
            );
          } else {
            Animated.spring(drag, { toValue: 0, damping: 18, stiffness: 220, mass: 1, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [drag, reduceMotion],
  );
  return (
    <Animated.View
      pointerEvents="box-none"
      testID={testID}
      {...(onDismiss ? pan.panHandlers : null)}
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
      style={[
        styles.wrap,
        {
          shadowColor: c.text,
          opacity: drop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: Animated.add(drop.interpolate({ inputRange: [0, 1], outputRange: [DROP.fromY, 0] }), drag) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.group,
    left: spacing.page,
    right: spacing.page,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
