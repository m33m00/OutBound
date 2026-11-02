import { AccessibilityInfo, Animated, Text } from 'react-native';
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
});
