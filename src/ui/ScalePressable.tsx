import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { PRESSED_OPACITY, type PressKind } from './press';
import { useReducedMotion } from './useReducedMotion';

/** How far a button shrinks under the finger: just a hair, like iOS (John, 2026-11-01). */
export const PRESS_SCALE = 0.97;
/** Down fast, back a little slower so the release reads. */
export const PRESS_IN_MS = 90;
export const PRESS_OUT_MS = 180;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How much it dims while pressed, as pressStyle. */
  kind?: PressKind;
}

/**
 * A Pressable that dims and shrinks a hair while held, on the native driver. Reduce Motion keeps
 * the dim and drops the shrink. The style's own opacity (a disabled button's) is kept.
 */
export function ScalePressable({ style, kind = 'fill', onPressIn, onPressOut, ...rest }: ScalePressableProps) {
  const reduce = useReducedMotion();
  const pressed = useRef(new Animated.Value(0)).current;
  const go = (to: number) => {
    pressed.stopAnimation();
    if (reduce) {
      pressed.setValue(to);
      return;
    }
    Animated.timing(pressed, {
      toValue: to,
      duration: to ? PRESS_IN_MS : PRESS_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  const flat = StyleSheet.flatten(style) ?? {};
  const base = typeof flat.opacity === 'number' ? flat.opacity : 1;
  const opacity = pressed.interpolate({ inputRange: [0, 1], outputRange: [base, base * PRESSED_OPACITY[kind]] });
  const scale = reduce ? 1 : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, PRESS_SCALE] });
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
