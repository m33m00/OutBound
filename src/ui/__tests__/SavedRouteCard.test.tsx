import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { zonedToUtc } from '@/engine';
import type { SavedRoute } from '@/trips/savedRoutes';

import { SavedRouteCard } from '../SavedRouteCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
/** Days before the route, so the card shows its date rather than Today or Tomorrow. */
const EARLIER = Date.UTC(2026, 9, 15, 12);
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

  // One per control: the card's press wrapper and the pressable inside it share a label.
  const buttons = () => {
    // The card's own buttons, not the airline logos on its route line (round 156).
    const all = r!.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.type !== 'string' &&
        n.props.onPress &&
        n.props.testID !== 'flight-peek-logo',
    );
    return all.filter((n, i) => all.findIndex((m) => m.props.accessibilityLabel === n.props.accessibilityLabel) === i);
  };

  it('shows path, day, times and flights, and reads them as words', async () => {
    const onOpen = jest.fn();
    const onRemove = jest.fn();
    await act(async () => {
      r = create(<SavedRouteCard route={route} past={false} now={EARLIER} onOpen={onOpen} onRemove={onRemove} />);
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(texts).toEqual(expect.arrayContaining(['DFW → ORD → LAX', 'Tue, Oct 20', '7:05 AM – 1:20 PM']));
    // The flights sit under their legs on a route line as airline logos, like the results (rounds 146, 156);
    // the numbers are in the card's spoken label below and in each logo's window.
    expect(r!.root.findAll((n) => n.props.testID === 'saved-route-line' && typeof n.type === 'string')).toHaveLength(1);
    expect(r!.root.findAll((n) => n.props.testID === 'mini-route-flight' && typeof n.type === 'string')).toHaveLength(2);
    expect(texts).not.toContain('Passed');
    // A boarding pass (round 114): the path and day on the navy stub, a torn edge, the flights below.
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');
    expect(host('saved-route-stub')).toHaveLength(1);
    expect(host('ticket-tear')).toHaveLength(1);
    const stubTexts = host('saved-route-stub')[0]
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(stubTexts).toEqual(['DFW → ORD → LAX', 'Tue, Oct 20', '7:05 AM – 1:20 PM']);
    const [open, remove] = buttons();
    expect(open.props.accessibilityLabel).toBe('DFW to ORD to LAX. Tue, Oct 20, 7:05 AM – 1:20 PM. Flights AA 1234, AA 88');
    expect(open.props.accessibilityHint).toBe('Searches this day again');
    expect(remove.props.accessibilityLabel).toBe('Remove DFW to ORD to LAX, Tue, Oct 20');
    act(() => open.props.onPress());
    act(() => remove.props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('tags a day that has passed instead of a sentence, and still says so to VoiceOver', async () => {
    await act(async () => {
      r = create(<SavedRouteCard route={route} past now={EARLIER} onOpen={jest.fn()} onRemove={jest.fn()} />);
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(texts).toContain('Passed');
    expect(texts.some((t) => t.includes('has passed'))).toBe(false);
    const [open] = buttons();
    expect(open.props.accessibilityLabel).toContain('Day passed. Opens today’s search.');
    expect(open.props.accessibilityHint).toBe('Searches today');
  });
});
