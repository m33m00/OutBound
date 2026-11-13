import React from 'react';
import { Animated, AccessibilityInfo, LayoutAnimation } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { radius, RADIUS } from '@/theme/spacing';

import { glideNextLayout } from '../motion';
import { Pop } from '../Pop';
import { StatusTag } from '../StatusTag';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('motion that means something (round 198, John)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });
  const timing = () => jest.spyOn(Animated, 'timing');

  it('a status pill settles in when it changes, not when it first shows', () => {
    const t = timing();
    act(() => {
      r = create(<StatusTag label="Delayed 25m" tone="delayed" />);
    });
    expect(t).not.toHaveBeenCalled();
    act(() => r!.update(<StatusTag label="Departed" tone="gone" />));
    expect(t).toHaveBeenCalledTimes(1);
    act(() => r!.update(<StatusTag label="Departed" tone="gone" />));
    expect(t).toHaveBeenCalledTimes(1);
  });

  it('with Reduce Motion a change only fades, never scales', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await act(async () => {
      r = create(
        <Pop on="a" testID="pop">
          {null}
        </Pop>,
      );
    });
    act(() =>
      r!.update(
        <Pop on="b" testID="pop">
          {null}
        </Pop>,
      ),
    );
    const view = r!.root.findAll((n) => n.props.testID === 'pop' && n.props.style !== undefined)[0];
    const flat = Object.assign({}, ...[view.props.style].flat(3).filter(Boolean));
    expect(flat.transform).toBeUndefined();
    expect(flat.opacity).toBeDefined();
  });

  it('a list glides on the next layout, and not at all with Reduce Motion', () => {
    const next = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});
    glideNextLayout(true);
    expect(next).not.toHaveBeenCalled();
    glideNextLayout(false);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('one corner radius everywhere (round 198, John)', () => {
  it('is a single token, with pills the only other value', () => {
    expect(RADIUS).toBe(14);
    expect(radius).toEqual({ all: RADIUS, pill: 999 });
  });
});
