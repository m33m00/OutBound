/**
 * The line key starts as a small chip and opens on tap (John, 2026-11-03: the open card crowded a
 * squished map).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RouteLegend } from '../RouteLegend';
import type { RouteLine } from '../types';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 21, 14, 0);
const route: RouteLine = {
  id: 'r1',
  legs: [
    { id: 'a', from: [-97, 33], to: [-88, 42], fromCode: 'DFW', toCode: 'ORD', tier: 'good', source: 'reported', departUtc: T0 },
    {
      id: 'b',
      from: [-88, 42],
      to: [-74, 41],
      fromCode: 'ORD',
      toCode: 'LGA',
      tier: 'tight',
      source: 'estimate',
      departUtc: T0 + 200 * MIN,
    },
  ],
};

describe('RouteLegend', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const button = () => r!.root.find((n) => n.props.testID === 'route-legend' && n.props.onPress && typeof n.type !== 'string');
  const texts = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);

  it('starts folded as a Key chip and opens to the full list on tap', () => {
    act(() => {
      r = create(<RouteLegend route={route} />);
    });
    expect(button().props.accessibilityLabel).toBe('Map key');
    expect(button().props.accessibilityState).toMatchObject({ expanded: false });
    expect(texts()).toEqual(['Map key']);

    act(() => button().props.onPress());
    expect(texts()).toContain('Line color is your chance of a seat');
    expect(button().props.accessibilityState).toMatchObject({ expanded: true });

    act(() => button().props.onPress());
    expect(texts()).toEqual(['Map key']);
  });

  it('follows the parent when it controls the open state', () => {
    const onToggle = jest.fn();
    act(() => {
      r = create(<RouteLegend route={route} open onToggle={onToggle} />);
    });
    expect(texts()).toContain('Map key');
    act(() => button().props.onPress());
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('opened, it explains itself in plain words for a new user (round 126, John)', () => {
    act(() => {
      r = create(<RouteLegend route={route} open />);
    });
    const all = texts();
    // A title, then what the color means, with a short meaning beside each chance word on this route.
    expect(all[0]).toBe('Map key');
    expect(all).toEqual(
      expect.arrayContaining([
        'Line color is your chance of a seat',
        'Likely',
        'Long shot',
        'Line style',
        'Solid line: seats someone reported',
        'Dashed line: our estimate',
        'Seat circles on the route card',
        '10/4',
        '10 open seats, 4 people listed',
      ]),
    );
    expect(r!.root.findAllByProps({ testID: 'legend-color' }).filter((n) => typeof n.type === 'string')).toHaveLength(2);
    const spoken = button().props.accessibilityLabel as string;
    expect(spoken).toContain('Likely, good odds of a seat.');
    expect(spoken).toContain('Long shot, only a few seats left.');
    expect(spoken).toContain('10 open seats, 4 people listed');
  });
});
