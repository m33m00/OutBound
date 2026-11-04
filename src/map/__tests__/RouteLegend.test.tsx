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

  it('starts folded with each line labeled, and opens to the full key on tap (round 137, John)', () => {
    act(() => {
      r = create(<RouteLegend route={route} />);
    });
    // John: the key "just says Map Key with no other context". Folded, each line says what it means.
    const folded = ['15 to 49 seats, reported', '1 to 5 seats, estimated', 'What the map shows ›'];
    expect(texts()).toEqual(folded);
    expect(button().props.accessibilityLabel).toBe(
      'Map key. 15 to 49 seats, reported, solid line. 1 to 5 seats, estimated, dashed line.',
    );
    expect(button().props.accessibilityState).toMatchObject({ expanded: false });

    act(() => button().props.onPress());
    expect(texts()).toContain('Line color is seats left after the list');
    expect(button().props.accessibilityState).toMatchObject({ expanded: true });

    act(() => button().props.onPress());
    expect(texts()).toEqual(folded);
  });

  it("explains the map's marks that are drawn now, and only those", () => {
    act(() => {
      r = create(<RouteLegend route={route} open marks={['home', 'origin', 'destination', 'stop']} badges={['likelyDelays']} />);
    });
    const rows = r!.root.findAll((n) => n.props.testID === 'legend-mark' && typeof n.type === 'string');
    expect(rows).toHaveLength(5);
    expect(texts()).toEqual(
      expect.arrayContaining([
        'On the map',
        'Where you leave from',
        'Where you connect',
        "Where you're going",
        'Your home',
        'Delays likely at that airport',
      ]),
    );
    expect(texts()).not.toContain('Weather to watch at that airport');
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
        'Line color is seats left after the list',
        '15 to 49 seats',
        '1 to 5 seats',
        'Line style',
        'Solid line: seats someone reported',
        'Dashed line: our estimate',
        'Seat circles on the route card',
        '10/4',
        '10 seats left, 4 people listed',
      ]),
    );
    expect(r!.root.findAllByProps({ testID: 'legend-color' }).filter((n) => typeof n.type === 'string')).toHaveLength(2);
    const spoken = button().props.accessibilityLabel as string;
    expect(spoken).toContain('Line color is seats left after the list: 15 to 49 seats. 1 to 5 seats.');
    expect(spoken).not.toMatch(/Likely|Long shot/);
    expect(spoken).toContain('10 seats left, 4 people listed');
  });
});
