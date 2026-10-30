import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

/** How long a panel takes to come in (design round 29). Short, so it never holds you up. */
export const APPEAR_MS = 180;
/** A pushed view starts this far to the right, like a small iOS push. */
export const PUSH_FROM = 24;

/**
 * Brings a panel in when it mounts or when `trigger` changes (design round 29):
 * 'fade' for a swap in place (search to results), 'push' to slide in a little
 * from the right while fading (a picked route). Reduce Motion: no movement, a
 * plain cross-fade only, as iOS does.
 */
export function Appear({
  kind = 'fade',
  trigger,
  style,
  testID,
  children,
}: {
  kind?: 'fade' | 'push';
  /** Plays again whenever this changes (for views that stay mounted). */
  trigger?: unknown;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: APPEAR_MS, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [progress, trigger]);

  const slide = kind === 'push' && !reduceMotion;
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.fill,
        style,
        {
          opacity: progress,
          transform: slide
            ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [PUSH_FROM, 0] }) }]
            : [],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
