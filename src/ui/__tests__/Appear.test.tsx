import React from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Appear, APPEAR_MS } from '../Appear';
import { Sheet } from '../Sheet';

// The native gesture module isn't in jest; the handle's drag isn't what these tests check.
jest.mock('react-native-gesture-handler', () => {
  const chain: object = new Proxy({}, { get: () => () => chain });
  return { GestureDetector: ({ children }: { children: unknown }) => children, Gesture: { Pan: () => chain } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let reduce = false;
beforeEach(() => {
  reduce = false;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduce));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(() => ({ remove: () => {} }) as never);
});
afterEach(() => jest.restoreAllMocks());

const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : ((style as Record<string, unknown>) ?? {});

describe('Appear (design round 29)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const host = () => r!.root.findAll((n) => n.props.testID === 'appear' && typeof n.type === 'string')[0];

  it('fades a panel in quickly and plays again when its trigger changes', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await act(async () => {
      r = create(
        <Appear testID="appear" trigger="a">
          <Text>Hi</Text>
        </Appear>,
      );
    });
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: APPEAR_MS, useNativeDriver: true });
    expect(flat(host().props.style).transform).toEqual([]);
    await act(async () => r!.update(<Appear testID="appear" trigger="b"><Text>Hi</Text></Appear>));
    expect(timing).toHaveBeenCalledTimes(2);
  });

  it('slides a pushed view in from the right, but not with Reduce Motion on', async () => {
    await act(async () => {
      r = create(<Appear testID="appear" kind="push"><Text>Route</Text></Appear>);
    });
    expect((flat(host().props.style).transform as unknown[]).length).toBe(1);
    act(() => r!.unmount());
    reduce = true;
    await act(async () => {
      r = create(<Appear testID="appear" kind="push"><Text>Route</Text></Appear>);
    });
    expect(flat(host().props.style).transform).toEqual([]);
  });
});

describe('Sheet snaps (design round 29)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('springs to a new size, and jumps with Reduce Motion on', async () => {
    const spring = jest.spyOn(Animated, 'spring');
    const sheet = (index: number) => (
      <Sheet snaps={[100, 300, 600]} index={index} onIndexChange={jest.fn()}>
        <Text>Body</Text>
      </Sheet>
    );
    await act(async () => {
      r = create(sheet(1));
    });
    spring.mockClear();
    await act(async () => r!.update(sheet(2)));
    expect(spring).toHaveBeenCalledTimes(1);
    expect(spring.mock.calls[0][1]).toMatchObject({ toValue: 600, bounciness: 0 });
    act(() => r!.unmount());
    reduce = true;
    await act(async () => {
      r = create(sheet(1));
    });
    spring.mockClear();
    await act(async () => r!.update(sheet(0)));
    expect(spring).not.toHaveBeenCalled();
  });
});
