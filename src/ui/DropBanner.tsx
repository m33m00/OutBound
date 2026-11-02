import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { spacing, useColors } from '@/theme';

import { useReducedMotion } from './useReducedMotion';

/** How far above its spot the banner starts, and how long it waits before it drops. */
export const DROP = { fromY: -140, delayMs: 350 } as const;

/**
 * A banner that drops down from the top into the map area (John, 2026-11-02: "like a banner
 * dropping down into the map area"). It springs in once when it mounts; with Reduce Motion it is
 * just there. It sits over the globe, under the top bar, and reports its height so the globe can
 * keep what it centers on clear of it.
 */
export function DropBanner({
  children,
  onHeight,
  testID = 'drop-banner',
}: {
  children: ReactNode;
  onHeight?: (height: number) => void;
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
  return (
    <Animated.View
      pointerEvents="box-none"
      testID={testID}
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
      style={[
        styles.wrap,
        {
          shadowColor: c.text,
          opacity: drop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [DROP.fromY, 0] }) }],
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
