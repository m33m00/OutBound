import React from 'react';
import { Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { outermost, restingStyle } from '@/testing/pressables';

import { PRESSED_OPACITY } from '../press';
import { PRESS_IN_MS, PRESS_OUT_MS, PRESS_SCALE, ScalePressable } from '../ScalePressable';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ScalePressable (John, 2026-11-01: buttons shrink a hair when pressed)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
  });

  it('shrinks and dims while held, keeps a disabled look, and springs back on release', () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    act(() => {
      r = create(
        <ScalePressable
          accessibilityRole="button"
          onPress={onPress}
          onPressIn={onPressIn}
          style={{ minHeight: 44, opacity: 0.5 }}>
          <Text>Go</Text>
        </ScalePressable>,
      );
    });
    // The animated layer: the one whose style carries the shrink.
    const [btn] = outermost(
      r!.root.findAll((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress && !!restingStyle(n).transform),
    );
    const scale = () =>
      (restingStyle(btn).transform as unknown as { scale: { __getValue: () => number } }[])[0].scale.__getValue();
    expect(restingStyle(btn)).toMatchObject({ minHeight: 44, opacity: 0.5 });
    expect(scale()).toBe(1);
    const timing = jest.spyOn(Animated, 'timing');
    act(() => btn.props.onPressIn({}));
    expect(onPressIn).toHaveBeenCalled();
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: PRESS_IN_MS, useNativeDriver: true });
    // Held all the way down: a hair smaller, a little dimmer, the disabled look kept.
    const value = timing.mock.calls[0][0] as Animated.Value;
    act(() => value.setValue(1));
    expect(scale()).toBeCloseTo(PRESS_SCALE, 3);
    expect(restingStyle(btn).opacity).toBeCloseTo(0.5 * PRESSED_OPACITY.fill, 3);
    act(() => btn.props.onPressOut({}));
    expect(timing.mock.calls[1][1]).toMatchObject({ toValue: 0, duration: PRESS_OUT_MS, useNativeDriver: true });
    timing.mockRestore();
    expect(PRESS_SCALE).toBeGreaterThanOrEqual(0.95);
  });
});
