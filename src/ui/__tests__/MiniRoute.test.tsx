import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MiniRoute } from '../MiniRoute';

describe('MiniRoute (round 119)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const texts = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);

  it('puts the ends big and each stop above its own dot', () => {
    act(() => {
      r = create(<MiniRoute airports={['DFW', 'ORD', 'LAX']} />);
    });
    expect(texts()).toEqual(['DFW', 'ORD', 'LAX']);
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-stop' && typeof n.type === 'string')).toHaveLength(1);
    // Drawn only: the row's own label says the route.
    const host = r!.root.find((n) => n.props.testID === 'mini-route' && typeof n.type === 'string');
    expect(host.props.accessibilityElementsHidden).toBe(true);
  });

  it('a nonstop is just the two ends', () => {
    act(() => {
      r = create(<MiniRoute airports={['DAL', 'LGA']} />);
    });
    expect(texts()).toEqual(['DAL', 'LGA']);
  });
});
