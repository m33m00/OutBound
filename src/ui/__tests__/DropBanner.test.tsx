import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Text,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DROP, DropBanner } from '../DropBanner';

describe('DropBanner (John, 2026-11-02)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  it('drops in from above the map: starts out of sight, then springs into place', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const spring = jest.spyOn(Animated, 'spring');
    await act(async () => {
      r = create(
        <DropBanner>
          <Text>At DAL? Report a load</Text>
        </DropBanner>,
      );
    });
    expect(r!.root.findByType(Text).props.children).toBe('At DAL? Report a load');
    expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, useNativeDriver: true }));
    expect(DROP.fromY).toBeLessThan(0);
  });

  it('with Reduce Motion it is just there, and says how tall it is so the globe keeps clear', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const onHeight = jest.fn();
    await act(async () => {
      r = create(
        <DropBanner onHeight={onHeight}>
          <Text>Banner</Text>
        </DropBanner>,
      );
    });
    const wrap = r!.root.findAll((n) => n.props.testID === 'drop-banner')[0];
    act(() => wrap.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 72 } } }));
    expect(onHeight).toHaveBeenCalledWith(72);
  });

  it('a swipe up past the line dismisses it; a short one springs back (John, 2026-11-02)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const create$ = jest.spyOn(PanResponder, 'create');
    const onDismiss = jest.fn();
    await act(async () => {
      r = create(
        <DropBanner onDismiss={onDismiss}>
          <Text>Banner</Text>
        </DropBanner>,
      );
    });
    const config = create$.mock.calls[create$.mock.calls.length - 1][0];
    const g = (dy: number, vy = 0) => ({ dx: 0, dy, vx: 0, vy }) as unknown as PanResponderGestureState;
    const e = {} as GestureResponderEvent;
    // Only an upward drag takes the touch, so the Report button still taps.
    expect(config.onMoveShouldSetPanResponder!(e, g(-20))).toBe(true);
    expect(config.onMoveShouldSetPanResponder!(e, g(20))).toBe(false);
    act(() => {
      config.onPanResponderRelease!(e, g(-10));
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      config.onPanResponderRelease!(e, g(DROP.dismissAt - 5));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
