import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { PRESSED_OPACITY, type PressKind } from './press';
import { useReducedMotion } from './useReducedMotion';

/** How far a button shrinks under the finger: just a hair, like iOS (John, 2026-11-01). */
export const PRESS_SCALE = 0.97;
/** Down fast, back a little slower so the release reads. */
export const PRESS_IN_MS = 90;
export const PRESS_OUT_MS = 180;
/** The release: settles in about PRESS_OUT_MS, with a few percent of overshoot, never a wobble. */
export const PRESS_SPRING = { speed: 22, bounciness: 5 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How much it dims while pressed, as pressStyle. */
  kind?: PressKind;
  /** Overrides how far it shrinks (1 = not at all); big cards shrink less than buttons. */
  scaleTo?: number;
  /** Overrides the dim while pressed (1 = none); big cards dim less so their colors hold. */
  pressedOpacity?: number;
}

/**
 * A Pressable that dims and shrinks a hair while held, on the native driver. Reduce Motion keeps
 * the dim and drops the shrink. The style's own opacity (a disabled button's) is kept.
 */
export function ScalePressable({
  style,
  kind = 'fill',
  scaleTo = PRESS_SCALE,
  pressedOpacity,
  onPressIn,
  onPressOut,
  ...rest
}: ScalePressableProps) {
  const reduce = useReducedMotion();
  const pressed = useRef(new Animated.Value(0)).current;
  const go = (to: number) => {
    pressed.stopAnimation();
    if (reduce) {
      pressed.setValue(to);
      return;
    }
    // Down is quick and firm; the release springs back with a whisper of overshoot (round 113).
    const anim = to
      ? Animated.timing(pressed, { toValue: 1, duration: PRESS_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })
      : Animated.spring(pressed, { toValue: 0, ...PRESS_SPRING, useNativeDriver: true });
    anim.start();
  };
  const flat = StyleSheet.flatten(style) ?? {};
  const base = typeof flat.opacity === 'number' ? flat.opacity : 1;
  const opacity = pressed.interpolate({
    inputRange: [0, 1],
    outputRange: [base, base * (pressedOpacity ?? PRESSED_OPACITY[kind])],
  });
  const scale = reduce ? 1 : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const transform = [...((flat.transform as unknown[] | undefined) ?? []), { scale }];
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        go(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        go(0);
        onPressOut?.(e);
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={[flat, { opacity, transform } as any]}
    />
  );
}
