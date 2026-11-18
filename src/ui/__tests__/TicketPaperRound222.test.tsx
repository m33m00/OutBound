import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';

import { ResultRow } from '../ResultRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);
const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
const host = (r: ReactTestRenderer, id: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);

async function trip(to = 'DEN') {
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'WN', flightNumber: '1', from: 'BNA', to, departUtc: at('09:00'), arriveUtc: at('11:50') }],
    {},
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: to, date: '2026-10-20' }, { now: NOW });
  return it;
}

// Round 222 (John: "Get rid of the backgrounds on the tickets I don't like it", "The landmark work").
describe('results tickets without the landmark sketch (round 222)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('keeps the paper grain and warmer stub but draws no sketch', async () => {
    const it = await trip('SEA');
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    expect(host(r!, 'ticket-grain')).toHaveLength(1);
    const perf = r!.root.findAll(
      (n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function' && n.props.collapsable === false,
    );
    await act(async () => {
      for (const p of perf) p.props.onLayout({ nativeEvent: { layout: { x: 0, y: 70, width: 300, height: 14 } } });
    });
    expect(StyleSheet.flatten(host(r!, 'ticket-stub-tone')[0].props.style).top).toBe(77);
    expect(host(r!, 'ticket-sketch')).toHaveLength(0);
    expect(host(r!, 'ticket-sketch-art')).toHaveLength(0);
  });
});
