import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

/** A row's rise and fade, and the gap between rows (round 113: subtle, never in the way). */
export const STAGGER = { ms: 260, stepMs: 40, maxSteps: 8, fromY: 10 } as const;

/**
 * Brings a list row in with a short fade and rise, each row a beat after the one above
 * (John, 2026-11-02: it felt bare-bones and missing animation; keep it clean). Plays only when
 * `play` is true, so rows scrolled into view later just appear. Reduce Motion: no movement.
 */
export function StaggerIn({ step, play, children }: { step: number; play: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  const animate = play && !reduce;
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: STAGGER.ms,
      delay: Math.min(Math.max(0, step), STAGGER.maxSteps) * STAGGER.stepMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Plays once, when the row mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      testID="stagger-in"
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [STAGGER.fromY, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}
