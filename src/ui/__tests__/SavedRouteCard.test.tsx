import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { zonedToUtc } from '@/engine';
import type { SavedRoute } from '@/trips/savedRoutes';

import { SavedRouteCard } from '../SavedRouteCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
const route: SavedRoute = {
  key: '2026-10-20|AA1234:DFW-ORD+AA88:ORD-LAX',
  request: { origin: 'DFW', destination: 'LAX', date: '2026-10-20', originArea: false, destinationArea: false },
  legs: [
    { airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'ORD', departUtc: at('07:05'), arriveUtc: at('09:20') },
    { airline: 'AA', flightNumber: '88', from: 'ORD', to: 'LAX', departUtc: at('10:45'), arriveUtc: at('15:20') },
  ],
  savedAt: 0,
};

describe('SavedRouteCard', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const buttons = () => r!.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type !== 'string' && n.props.onPress);

  it('shows path, day, times and flights, and reads them as words', async () => {
    const onOpen = jest.fn();
    const onRemove = jest.fn();
    await act(async () => {
      r = create(<SavedRouteCard route={route} past={false} onOpen={onOpen} onRemove={onRemove} />);
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(texts).toEqual(expect.arrayContaining(['DFW → ORD → LAX', 'Tue, Oct 20 · 7:05 AM – 1:20 PM', 'AA 1234, AA 88']));
    const [open, remove] = buttons();
    expect(open.props.accessibilityLabel).toBe('DFW to ORD to LAX. Tue, Oct 20, 7:05 AM – 1:20 PM. Flights AA 1234, AA 88');
    expect(open.props.accessibilityHint).toBe('Searches this day again');
    expect(remove.props.accessibilityLabel).toBe('Remove DFW to ORD to LAX, Tue, Oct 20');
    act(() => open.props.onPress());
    act(() => remove.props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('says when its day has passed', async () => {
    await act(async () => {
      r = create(<SavedRouteCard route={route} past onOpen={jest.fn()} onRemove={jest.fn()} />);
    });
    const [open] = buttons();
    expect(open.props.accessibilityLabel).toContain('This day has passed. Opens today’s search.');
    expect(open.props.accessibilityHint).toBe('Searches today');
  });
});
