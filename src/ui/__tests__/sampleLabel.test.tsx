import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';

import { ResultsPanel } from '../ResultsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);

describe('no sample labels (design round 30, John 2026-10-30)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('shows sample flights like the finished app, with no "Sample" chips', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [{ id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'LAX', departUtc: at('09:00'), arriveUtc: at('13:20') }],
      {},
    );
    const request = { origin: 'BNA', destination: 'LAX', date: '2026-10-20' };
    const list = await searchItineraries(provider, request, { now: NOW });
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    for (const selectedId of [null, list[0].id]) {
      await act(async () => {
        r = create(
          <ResultsPanel state={state} selectedId={selectedId} now={NOW} onSelect={jest.fn()} onBack={jest.fn()} onRetry={jest.fn()} sampleFlights />,
        );
      });
      const texts = r!.root
        .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
        .map((n) => n.props.children as string);
      expect(texts.some((t) => /sample/i.test(t))).toBe(false);
      act(() => r!.unmount());
      r = undefined;
    }
  });
});
