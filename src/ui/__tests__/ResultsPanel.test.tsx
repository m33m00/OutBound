import React from 'react';
import { AccessibilityInfo, FlatList, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { dateChips } from '@/search/dates';

import { areaLines, isHardPullDown, nowLineIndex, ResultsPanel, routeEnds, routeFlip } from '../ResultsPanel';

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

  it("titles a picked route by its own airports, not the search's (round 90)", async () => {
    const { list } = await results();
    // An area search from DAL whose route flies from another airport (BNA here).
    const request = { origin: 'DAL', destination: 'LAX', date: '2026-10-20', originArea: true };
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={list[0].id}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
        />,
      );
    });
    const view = r!.root.findAll((n) => n.props.testID === 'route-view' && typeof n.type === 'string')[0];
    const header = view.find((n) => n.props.accessibilityRole === 'header' && typeof n.type === 'string');
    // The title is two airport pills, the route's own ends (round 132).
    const codes = header
      .findAll((n) => n.props.testID === 'route-end' && typeof n.type === 'string')
      .map((n) => n.findAll((x) => typeof x.props.children === 'string')[0].props.children);
    expect(codes).toEqual(['BNA', 'LAX']);
    expect(header.props.accessibilityLabel).toBe('BNA to LAX');
    expect(routeEnds({ legs: [] })).toBeNull();
    raf.mockRestore();
  });

  it('goes from loading to results without changing its hooks (round 56 review)', async () => {
    const { request, list } = await results();
    const props = { selectedId: list[0].id, now: NOW, onSelect: jest.fn(), onBack: jest.fn(), onRetry: jest.fn() };
    // No real frames: opening the route schedules a VoiceOver focus that would land in a later test.
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
    await act(async () => {
      r = create(<ResultsPanel state={{ status: 'loading', request }} {...props} />);
    });
    const done = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r!.update(<ResultsPanel state={done} {...props} />);
    });
    expect(r!.root.findAll((n) => n.props.testID === 'route-view' && typeof n.type === 'string').length).toBe(1);
    raf.mockRestore();
  });

  it('reports the open route height (title bar plus content) so the panel fits it without scrolling (round 56)', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const onRouteHeight = jest.fn();
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={list[0].id}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
          onRouteHeight={onRouteHeight}
        />,
      );
    });
    const view = r!.root.findAll((n) => n.props.testID === 'route-view' && typeof n.type === 'string')[0];
    const bar = view.findAll((n) => typeof n.props.onLayout === 'function')[0];
    const scroll = view.findAll((n) => typeof n.props.onContentSizeChange === 'function')[0];
    act(() => bar.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 60.4 } } }));
    expect(onRouteHeight).not.toHaveBeenCalled();
    act(() => scroll.props.onContentSizeChange(393, 300));
    expect(onRouteHeight).toHaveBeenLastCalledWith(361);
  });

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
      .findAll((n) => typeof n.type === 'string' && (n.props.testID === 'selected-card' || n.props.testID === 'route-card'))
      .map((n) => (n.props.testID === 'selected-card' ? 'leave-by' : 'route'));
    expect(order[0]).toBe('leave-by');
    expect(order).toContain('route');
    // The route card in this view doesn't close on a stray tap; only "‹ Routes" does.
    const card = view[0].findAll((n) => n.props.testID === 'route-card' && typeof n.type !== 'string')[0];
    expect(card.props.onPress).toBeUndefined();
    expect(card.props.accessibilityRole).toBeUndefined();
    // Only one card on screen; the list is hidden but kept.
    expect(r!.root.findAll((n) => n.props.testID === 'card' && typeof n.type === 'string').length).toBe(1);
    // "2 of 2": next is off at the end, previous picks the first route.
    expect(r!.root.findAll((n) => n.props.accessibilityLabel === 'Route 2 of 2').length).toBeGreaterThan(0);
    // A dot per route under the market, the current one with nothing to press; tapping the other picks it
    // (round 134). Small arrows either side of the dots say it pages (round 136, John: "Hard for a user
    // to know they can swipe"): next is off at the end, previous picks the first route.
    const arrow = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.props.disabled === 'boolean')[0];
    expect(arrow('route-next').props.disabled).toBe(true);
    expect(arrow('route-prev').props.disabled).toBe(false);
    act(() => arrow('route-prev').props.onPress());
    expect(onSelect).toHaveBeenCalledWith(list[0].id);
    onSelect.mockClear();
    const dots = r!.root.findAll(
      (n) => n.props.testID === 'route-dot' && typeof n.type !== 'string' && n.parent?.props.testID !== 'route-dot',
    );
    expect(dots).toHaveLength(2);
    expect(dots[1].props.onPress).toBeUndefined();
    act(() => dots[0].props.onPress());
    expect(onSelect).toHaveBeenCalledWith(list[0].id);
    // VoiceOver flips routes by swiping on the count; nothing past the end.
    const count = r!.root.findAll((n) => n.props.testID === 'route-count' && n.props.accessibilityRole === 'adjustable')[0];
    onSelect.mockClear();
    act(() => count.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onSelect).not.toHaveBeenCalled();
    act(() => count.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(onSelect).toHaveBeenCalledWith(list[0].id);
    // The market is two airport pills with a plane between (round 132, John); back is a bare chevron (round 122).
    const title = r!.root.findAll((n) => n.props.testID === 'route-title' && typeof n.type === 'string')[0];
    expect(title.props.accessibilityRole).toBe('header');
    const ends = title.findAll((n) => n.props.testID === 'route-end' && typeof n.type === 'string');
    expect(ends).toHaveLength(2);
    const bar = r!.root.findAll((n) => n.props.testID === 'route-bar' && typeof n.type === 'string')[0];
    const barTexts = bar.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(barTexts).not.toContain('Routes');
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
      'Landing at any Dallas, TX airport (DAL, DFW)',
    ]);
    expect(areaLines({ origin: 'DFW', destination: 'BNA', date: '2026-10-20', originArea: true })).toEqual([
      'Leaving from any Dallas, TX airport (DAL, DFW)',
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
    // The count sits beside "Departing Tue, Oct 20" over the day buttons (round 177, John).
    const detail = r!.root.findAll((n) => n.props.testID === 'day-detail' && typeof n.type === 'string')[0];
    expect(detail.props.children).toBe('2 routes');
    expect(texts()).toContain('Departing Tue, Oct 20');
    const next = r!.root.findAll((n) => n.props.testID === 'day-2026-10-21' && n.props.accessibilityRole === 'radio')[0];
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
    expect(summary.props.children).toBe('Tue, Oct 20\n2 routes');
    expect(r!.root.findAll((n) => n.props.testID === 'day-picker').length).toBe(0);
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
        <ResultsPanel
          state={state}
          selectedId={null}
          now={between}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
        />,
      );
    });
    const lines = r!.root.findAll((n) => n.props.testID === 'now-line' && typeof n.type === 'string');
    expect(lines.length).toBe(1);
    expect(lines[0].props.accessibilityLabel).toBe('Now, 12:00 PM. Flights below haven’t left yet.');
    // Another day's flights get no Now line, even with some routes above (John, 2026-11-02).
    await act(async () => {
      r!.update(
        <ResultsPanel
          state={{ ...state, request: { ...request, date: '2026-10-21' } }}
          selectedId={null}
          now={between}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
        />,
      );
    });
    expect(r!.root.findAll((n) => n.props.testID === 'now-line' && typeof n.type === 'string')).toHaveLength(0);
  });

  it('opens the list at the Now line, with routes that left a scroll up (John, 2026-10-30)', async () => {
    const { request, list } = await results();
    const between = zonedToUtc('2026-10-20', '12:00', 'America/Chicago');
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    await act(async () => {
      r = create(
        <ResultsPanel
          state={state}
          selectedId={null}
          now={between}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
        />,
      );
    });
    expect(scroll).toHaveBeenCalledWith({ index: 1, viewPosition: 0, animated: false });
    // Rows measure in and the panel grows: it pins to the Now line again until you scroll (John, 2026-11-02).
    const flat = r!.root.findByType(FlatList);
    scroll.mockClear();
    act(() => flat.props.onContentSizeChange(390, 1200));
    expect(scroll).toHaveBeenCalledWith({ index: 1, viewPosition: 0, animated: false });
    scroll.mockClear();
    act(() => flat.props.onScrollBeginDrag());
    act(() => flat.props.onContentSizeChange(390, 1300));
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockClear();
    // Nothing has left yet the day before: the list starts at the top as usual.
    await act(async () => {
      r!.update(
        <ResultsPanel
          state={{ ...state, searchedAt: NOW + 1 }}
          selectedId={null}
          now={NOW}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          onRetry={jest.fn()}
        />,
      );
    });
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
    raf.mockRestore();
  });

  it('coming back from a route lands on the Now line again, even after a scroll (John, 2026-11-02)', async () => {
    const { request, list } = await results();
    const between = zonedToUtc('2026-10-20', '12:00', 'America/Chicago');
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const panel = (selectedId: string | null) => (
      <ResultsPanel
        state={state}
        selectedId={selectedId}
        now={between}
        onSelect={jest.fn()}
        onBack={jest.fn()}
        onRetry={jest.fn()}
      />
    );
    await act(async () => {
      r = create(panel(null));
    });
    act(() => r!.root.findByType(FlatList).props.onScrollBeginDrag());
    await act(async () => r!.update(panel(list[0].id)));
    scroll.mockClear();
    await act(async () => r!.update(panel(null)));
    expect(scroll).toHaveBeenCalledWith({ index: 1, viewPosition: 0, animated: false });
    scroll.mockRestore();
    raf.mockRestore();
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

  it('saves a route from its ticket in the list, not the opened route, and shows when it is saved (Q-043, round 151)', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const onToggleSave = jest.fn();
    const panel = (saved: boolean, selectedId: string | null = null) => (
      <ResultsPanel
        state={state}
        selectedId={selectedId}
        now={NOW}
        onSelect={jest.fn()}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        isSaved={() => saved}
        onToggleSave={onToggleSave}
      />
    );
    await act(async () => {
      r = create(panel(false));
    });
    const buttons = () =>
      r!.root.findAll(
        (n) => n.props.testID === 'save-route' && n.props.accessibilityRole === 'button' && typeof n.type === 'string',
      );
    const button = () => buttons()[0];
    // One on each ticket, top right (round 151, John: "We already have the space to put a save icon on the top right").
    expect(buttons()).toHaveLength(list.length);
    expect(button().props.accessibilityLabel).toBe('Save Route');
    const slots = r!.root.findAll((n) => n.props.testID === 'row-action' && typeof n.type === 'string');
    expect(slots).toHaveLength(list.length);
    expect(button().props.accessibilityHint).toBe('Keeps it in My Trips');
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const pressable = r!.root.findAll((n) => n.props.testID === 'save-route' && typeof n.props.onPress === 'function')[0];
    act(() => pressable.props.onPress());
    expect(onToggleSave).toHaveBeenCalledWith(list[0]);
    expect(announce).toHaveBeenCalledWith('Saved to My Trips');
    announce.mockRestore();
    await act(async () => r!.update(panel(true)));
    expect(button().props.accessibilityLabel).toBe('Saved to My Trips');
    expect(button().props.accessibilityHint).toBe('Removes it from My Trips');
    // The opened route has no Save and no swipe of its own any more.
    await act(async () => r!.update(panel(false, list[0].id)));
    const card = r!.root.findAll((n) => n.props.testID === 'route-card' && typeof n.type === 'string')[0];
    expect(card.findAll((n) => n.props.testID === 'save-route')).toHaveLength(0);
    expect(card.findAll((n) => n.props.testID === 'route-card-action')).toHaveLength(0);
    expect(card.findAll((n) => n.props.testID === 'tear-swipe')).toHaveLength(0);
  });

  it('has no Save Route without a handler, and shows a note under the count', async () => {
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
          note="Your saved flights aren’t in this search anymore."
        />,
      );
    });
    expect(r!.root.findAll((n) => n.props.testID === 'save-route').length).toBe(0);
    const note = r!.root.findAll((n) => n.props.testID === 'results-note' && typeof n.type === 'string');
    expect(note[0].props.children).toBe('Your saved flights aren’t in this search anymore.');
  });

  it('marks saved routes in the list with a bookmark and says so to VoiceOver (Q-043)', async () => {
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
          isSaved={(it) => it.id === list[1].id}
          onToggleSave={jest.fn()}
        />,
      );
    });
    // The ticket's own bookmark shows it filled, so the small mark by the route line isn't needed (round 151).
    expect(r!.root.findAll((n) => n.props.testID === 'row-saved')).toHaveLength(0);
    const saves = r!.root.findAll(
      (n) => n.props.testID === 'save-route' && n.props.accessibilityRole === 'button' && typeof n.type === 'string',
    );
    expect(saves.map((n) => n.props.accessibilityLabel)).toEqual(['Save Route', 'Saved to My Trips']);
    const rows = r!.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.type === 'string' &&
        n.props.accessibilityHint?.startsWith('Opens the route card'),
    );
    const saidSaved = rows.map((n) => (n.props.accessibilityLabel as string).endsWith('Saved to My Trips'));
    expect(saidSaved).toEqual([false, true]);
  });

  it('moves VoiceOver to the route title on open, and back to the list title on close (design round 29)', async () => {
    const { request, list } = await results();
    const state = { status: 'done' as const, request, results: list, hiddenCount: 0, hiddenResults: [], searchedAt: NOW };
    const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
    // React Native's test setup makes this a shared mock, so drop calls from earlier tests.
    send.mockClear();
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const panel = (selectedId: string | null) => (
      <ResultsPanel state={state} selectedId={selectedId} now={NOW} onSelect={jest.fn()} onBack={jest.fn()} onRetry={jest.fn()} />
    );
    await act(async () => {
      r = create(panel(null));
    });
    expect(send).not.toHaveBeenCalled();
    await act(async () => r!.update(panel(list[0].id)));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => r!.update(panel(null)));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.every((call) => call[1] === 'focus')).toBe(true);
    send.mockRestore();
    raf.mockRestore();
  });
});

describe('hard pull down (round 58)', () => {
  it('counts a pull well past the top or a fast flick down at the top, not a scroll further down', () => {
    expect(isHardPullDown({ contentOffset: { x: 0, y: -60 } })).toBe(true);
    expect(isHardPullDown({ contentOffset: { x: 0, y: -20 } })).toBe(false);
    expect(isHardPullDown({ contentOffset: { x: 0, y: 0 }, velocity: { x: 0, y: -1.5 } })).toBe(true);
    expect(isHardPullDown({ contentOffset: { x: 0, y: 120 }, velocity: { x: 0, y: -3 } })).toBe(false);
    expect(isHardPullDown({ contentOffset: { x: 0, y: 0 }, velocity: { x: 0, y: 2 } })).toBe(false);
  });
});

describe('flipping routes by swiping the route bar (round 134, John)', () => {
  it('flips to the next route on a swipe left and back on a swipe right, far or fast enough', () => {
    expect(routeFlip(-60, 0)).toBe(1);
    expect(routeFlip(60, 0)).toBe(-1);
    expect(routeFlip(-20, -800)).toBe(1);
    expect(routeFlip(20, 800)).toBe(-1);
    expect(routeFlip(-20, -100)).toBe(0);
    expect(routeFlip(-80, 0, true)).toBe(0);
  });
});

describe('the route card shows once that it slides sideways (round 136, John)', () => {
  it('plays the first time only, and remembers that on the phone', async () => {
    const { takeFlipHint, resetFlipHintForTests, FLIP_HINT_KEY } = jest.requireActual(
      '../flipHint',
    ) as typeof import('../flipHint');
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();
    resetFlipHintForTests();
    expect(await takeFlipHint()).toBe(true);
    expect(await takeFlipHint()).toBe(false);
    expect(await AsyncStorage.getItem(FLIP_HINT_KEY)).toBe('1');
    // A fresh start reads it back and stays quiet.
    resetFlipHintForTests();
    expect(await takeFlipHint()).toBe(false);
  });
});
