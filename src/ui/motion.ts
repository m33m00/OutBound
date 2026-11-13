import { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutAnimation, Platform } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

/**
 * Motion that means something (round 198, John: "Give animations throughout the app that mean something").
 * Each one answers "what just changed?" or "where did it go?", never decoration:
 *   - useChangePop: a value or state just changed here (a status pill turns Departed, a credit box gets ticked,
 *     a leg turns canceled). A quick settle from a little smaller and fainter, no bounce.
 *   - useCountRoll: a number went down or up (credits spent or earned). The new number slides in from the side
 *     it came from.
 *   - glideNextLayout: something left or joined a list (a request deleted or brought back). The rows around it
 *     glide into place instead of jumping.
 * Never on first show, so a screen opening doesn't wobble. With Reduce Motion on, nothing moves: changes
 * cross-fade instead, and lists don't glide.
 */
export const POP_MS = 220;

/** Only after the first render: does `key` differ from what it was last render? */
function useChanged(key: unknown): boolean {
  const last = useRef(key);
  const changed = last.current !== key;
  last.current = key;
  return changed;
}

/** A quick settle when `key` changes (not on first show). Returns a style for an Animated.View. */
export function useChangePop(key: unknown) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  const changed = useChanged(key);
  useEffect(() => {
    if (!changed) return;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: reduce ? 150 : POP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  if (reduce) return { opacity };
  return { opacity, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] };
}

/**
 * A number that changed slides in from the way it moved: down (spent) comes from above, up (earned) from below.
 * Returns a style for the Animated.Text holding the number.
 */
export function useCountRoll(n: number) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  const last = useRef(n);
  const dir = useRef(0);
  useEffect(() => {
    if (last.current === n) return;
    dir.current = n < last.current ? -1 : 1;
    last.current = n;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: reduce ? 150 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  if (reduce) return { opacity };
  return {
    opacity,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dir.current * -8, 0] }) }],
  };
}

/** The rows around something that joins or leaves a list glide into place on the next layout. */
export function glideNextLayout(reduce: boolean): void {
  if (reduce || Platform.OS === 'web') return;
  LayoutAnimation.configureNext({
    duration: 240,
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
