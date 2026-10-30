import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';

import { ResultsPanel } from '../ResultsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);

async function results() {
  const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
  const provider = createMemoryProvider(
    [
      { id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'LAX', departUtc: at('09:00'), arriveUtc: at('13:20') },
      { id: 'F2', airline: 'AA', flightNumber: '2', from: 'BNA', to: 'LAX', departUtc: at('15:00'), arriveUtc: at('19:20') },
    ],
    {},
  );
  const request = { origin: 'BNA', destination: 'LAX', date: '2026-10-20' };
  return { request, list: await searchItineraries(provider, request, { now: NOW }) };
}

describe('ResultsPanel', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('shows the leave-by card right under the selected row, inside the list', async () => {
    const { request, list } = await results();
    expect(list.length).toBe(2);
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={list[1].id}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
          selectedCard={<Text testID="card">Leave by 1:45 PM</Text>}
        />,
      );
    });
    const blocks = r!.root.findAll((n) => n.props.testID === 'selected-block' && typeof n.type === 'string');
    expect(blocks.length).toBe(1);
    // The card is inside the selected row's block, after the row.
    const block = blocks[0];
    expect(block.findAll((n) => n.props.testID === 'card' && typeof n.type === 'string').length).toBe(1);
    const row = block.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityState).toEqual({ selected: true });
    // Only one card on screen.
    expect(r!.root.findAll((n) => n.props.testID === 'card' && typeof n.type === 'string').length).toBe(1);
  });

  it('shows no card when nothing is selected', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={null}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
          selectedCard={null}
        />,
      );
    });
    expect(r!.root.findAll((n) => n.props.testID === 'selected-block').length).toBe(0);
  });
});
