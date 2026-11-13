import React from 'react';
import { FlatList } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc, type Itinerary } from '@/engine';
import { DEFAULT_RESULT_PREFS } from '@/search/arrange';
import type { RowStatus } from '@/search/statusTags';

import { ResultsPanel } from '../ResultsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

const NOW = Date.UTC(2026, 9, 19, 12);
const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
const row = (canceled: boolean): RowStatus => ({ legs: [], risks: [], dimmed: false, canceled, spoken: [] });

describe('ResultsPanel itinerary preferences (Jayden, 2026-11-13)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  async function render(prefs = DEFAULT_RESULT_PREFS) {
    const provider = createMemoryProvider(
      [
        { id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'LAX', departUtc: at('09:00'), arriveUtc: at('16:20') },
        { id: 'F2', airline: 'AA', flightNumber: '2', from: 'BNA', to: 'LAX', departUtc: at('11:00'), arriveUtc: at('13:20') },
        { id: 'F3', airline: 'AA', flightNumber: '3', from: 'BNA', to: 'LAX', departUtc: at('15:00'), arriveUtc: at('19:20') },
      ],
      {},
    );
    const request = { origin: 'BNA', destination: 'LAX', date: '2026-10-20' };
    const list = await searchItineraries(provider, request, { now: NOW });
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
          statuses={{ F1: row(false), F2: row(false), F3: row(true) }}
          prefs={prefs}
        />,
      );
    });
    const shown = (r!.root.findByType(FlatList).props.data as Itinerary[]).map((it) => it.id);
    const note = (testID: string) =>
      r!.root.findAll((n) => n.props.testID === testID && typeof n.props.children === 'string')[0]?.props.children;
    return { shown, note };
  }

  it('hides the canceled route by default and says so', async () => {
    const { shown, note } = await render();
    expect(shown).toEqual(['F1', 'F2']);
    expect(note('results-canceled-hidden')).toBe('1 route with a canceled flight hidden. Filters can show it.');
    expect(note('results-order')).toBeUndefined();
  });

  it('shows it when Show canceled routes is on', async () => {
    const { shown, note } = await render({ ...DEFAULT_RESULT_PREFS, showCanceled: true });
    expect(shown).toEqual(['F1', 'F2', 'F3']);
    expect(note('results-canceled-hidden')).toBeUndefined();
  });

  it('orders by arrival and says so', async () => {
    const { shown, note } = await render({ sortBy: 'arrival', showCanceled: true });
    expect(shown).toEqual(['F2', 'F1', 'F3']);
    expect(note('results-order')).toBe('Earliest arrival first.');
  });
});
