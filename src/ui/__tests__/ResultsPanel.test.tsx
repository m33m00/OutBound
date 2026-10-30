import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { dateChips } from '@/search/dates';

import { areaLines, nowLineIndex, ResultsPanel } from '../ResultsPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));
beforeEach(() => {
  mockFontScale = 1;
});

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

  it('opens a picked route in its own view: leave-by on top, then the route card (John, 2026-10-30)', async () => {
    const { request, list } = await results();
    expect(list.length).toBe(2);
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const onSelect = jest.fn();
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={list[1].id}
          now={NOW}
          onSelect={onSelect}
          onBack={jest.fn()}
          onRetry={jest.fn()}
          selectedCard={<Text testID="card">Leave by 1:45 PM</Text>}
        />,
      );
    });
    const view = r!.root.findAll((n) => n.props.testID === 'route-view' && typeof n.type === 'string');
    expect(view.length).toBe(1);
    // Leave-by comes before the route card.
    const order = view[0]
      .findAll((n) => typeof n.type === 'string' && (n.props.testID === 'selected-card' || n.props.accessibilityState?.selected === true))
      .map((n) => (n.props.testID === 'selected-card' ? 'leave-by' : 'route'));
    expect(order[0]).toBe('leave-by');
    expect(order).toContain('route');
    // Only one card on screen; the list is hidden but kept.
    expect(r!.root.findAll((n) => n.props.testID === 'card' && typeof n.type === 'string').length).toBe(1);
    // "2 of 2": next is off at the end, previous picks the first route.
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Route 2 of 2').length).toBeGreaterThan(0);
    const arrow = (dir: string) => r!.root.findAll((n) => n.props.testID === `route-${dir}` && n.props.accessibilityRole === 'button')[0];
    expect(arrow('next').props.accessibilityState).toEqual({ disabled: true });
    act(() => arrow('prev').props.onPress());
    expect(onSelect).toHaveBeenCalledWith(list[0].id);
    // Back to all routes closes the view.
    const back = r!.root.findAll((n) => n.props.accessibilityLabel === 'Back to all routes' && n.props.onPress)[0];
    act(() => back.props.onPress());
    expect(onSelect).toHaveBeenLastCalledWith(list[1].id);
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
    expect(r!.root.findAll((n) => n.props.testID === 'route-view').length).toBe(0);
  });
});

describe('areaLines', () => {
  it('names the whole area when a side searched it', () => {
    expect(areaLines({ origin: 'LAX', destination: 'DAL', date: '2026-10-20', destinationArea: true })).toEqual([
      'Landing at any Dallas airport (DAL, DFW)',
    ]);
    expect(areaLines({ origin: 'DFW', destination: 'BNA', date: '2026-10-20', originArea: true })).toEqual([
      'Leaving from any Dallas airport (DAL, DFW)',
    ]);
  });

  it('says nothing when the area is off or the airport has no area', () => {
    expect(areaLines({ origin: 'DAL', destination: 'LAX', date: '2026-10-20' })).toEqual([]);
    expect(areaLines({ origin: 'BNA', destination: 'DAL', date: '2026-10-20', originArea: true })).toEqual([]);
  });
});

describe('ResultsPanel day and filters (Q-057)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const texts = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);

  it('steps the day and opens filters from the results header', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const onDay = jest.fn();
    const onFilters = jest.fn();
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={null}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
          days={dateChips('2026-10-19')}
          onDay={onDay}
          onFilters={onFilters}
          filtersChanged={2}
        />,
      );
    });
    // The date lives in the stepper, so the summary keeps only the count.
    const summary = r!.root.findAll((n) => n.props.testID === 'results-summary' && typeof n.type === 'string')[0];
    expect(summary.props.children).toBe('2 routes');
    expect(texts()).toContain('Tue, Oct 20');
    const next = r!.root.findAll((n) => n.props.testID === 'day-next' && n.props.accessibilityRole === 'button')[0];
    act(() => next.props.onPress());
    expect(onDay).toHaveBeenCalledWith('2026-10-21');
    const filters = r!.root.findAll((n) => n.props.accessibilityLabel === 'Filters, 2 changed' && n.props.onPress)[0];
    expect(texts()).toContain('Filters (2)');
    act(() => filters.props.onPress());
    expect(onFilters).toHaveBeenCalled();
  });

  it('keeps the plain date line when the header has no day stepper', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r = create(
        <ResultsPanel state={state} selectedId={null} now={NOW} onSelect={jest.fn()} onBack={jest.fn()} onRetry={jest.fn()} />,
      );
    });
    const summary = r!.root.findAll((n) => n.props.testID === 'results-summary' && typeof n.type === 'string')[0];
    expect(summary.props.children).toBe('Tue, Oct 20 · 2 routes');
    expect(r!.root.findAll((n) => n.props.testID === 'day-next').length).toBe(0);
  });
});

describe('Now line', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('sits above the first route still to leave, only when some already left', async () => {
    const { request, list } = await results(); // 9:00 and 15:00 Central on Oct 20
    const between = zonedToUtc('2026-10-20', '12:00', 'America/Chicago');
    expect(nowLineIndex(list, between)).toBe(1);
    expect(nowLineIndex(list, NOW)).toBe(-1); // the day before: nothing left yet
    expect(nowLineIndex(list, zonedToUtc('2026-10-20', '18:00', 'America/Chicago'))).toBe(-1); // all gone
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r = create(
        <ResultsPanel state={state} selectedId={null} now={between} onSelect={jest.fn()} onBack={jest.fn()} onRetry={jest.fn()} />,
      );
    });
    const lines = r!.root.findAll((n) => n.props.testID === 'now-line' && typeof n.type === 'string');
    expect(lines.length).toBe(1);
    expect(lines[0].props.accessibilityLabel).toBe('Now, 12:00 PM. Flights below haven’t left yet.');
  });
});

describe('results bar at big text sizes', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('shows Back and Filters as icons so the title keeps room, and speaks the route', async () => {
    mockFontScale = 1.5;
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
          days={dateChips('2026-10-19')}
          onDay={jest.fn()}
          onFilters={jest.fn()}
          filtersChanged={2}
        />,
      );
    });
    const texts = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(texts).not.toContain('Search');
    expect(texts).not.toContain('Filters (2)');
    expect(texts).toContain('2');
    const title = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && typeof n.type === 'string')[0];
    expect(title.props.accessibilityLabel).toBe('BNA to LAX');
    expect(title.props.numberOfLines).toBe(2);
  });
});
