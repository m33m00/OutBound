import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { dateChips } from '@/search/dates';

import { SearchPanel, SWAP_MS, SWAP_SLIDE, WRAP_CHIPS_SCALE } from '../SearchPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

function render(fontScale: number, extra: Partial<React.ComponentProps<typeof SearchPanel>> = {}) {
  mockFontScale = fontScale;
  const chips = dateChips('2026-10-20');
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = create(
      <SearchPanel
        chips={chips}
        date={chips[0].date}
        onDate={jest.fn()}
        origin="DAL"
        destination="LAX"
        onPickOrigin={jest.fn()}
        onPickDestination={jest.fn()}
        onSwap={jest.fn()}
        areaOn={{}}
        onToggleArea={jest.fn()}
        onFilters={jest.fn()}
        filtersChanged={0}
        onFind={jest.fn()}
        {...extra}
      />,
    );
  });
  return r!;
}

const chipRow = (r: ReactTestRenderer) =>
  StyleSheet.flatten(r.root.findAll((n) => n.props.testID === 'date-chips' && typeof n.type === 'string')[0].props.style);

describe('SearchPanel text size', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
  });

  it('draws every date chip the same way: a small top word over the bold date, never shrunk (John, 2026-11-01)', () => {
    r = render(1, { date: dateChips('2026-10-20')[6].date });
    const chips = r.root.findAll((n) => n.props.testID === 'chip-date' && typeof n.type === 'string');
    // Four quick chips, plus the calendar holding the later day.
    expect(chips).toHaveLength(5);
    const lines = chips.map((ch) => ch.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string'));
    expect(lines.map((l) => l.map((t) => t.props.children))).toEqual([
      ['Today', 'Oct 20'],
      ['Tomorrow', 'Oct 21'],
      ['Thu', 'Oct 22'],
      ['Fri', 'Oct 23'],
      ['Mon', 'Oct 26'],
    ]);
    const sizes = new Set(lines.map((l) => l.map((t) => StyleSheet.flatten(t.props.style).fontSize).join('/')));
    expect(sizes.size).toBe(1);
    expect(lines.flat().some((t) => t.props.adjustsFontSizeToFit)).toBe(false);
  });

  it('keeps the date chips on one row at normal sizes', () => {
    r = render(1);
    expect(chipRow(r).flexWrap).toBeUndefined();
  });

  it('wraps the date chips two to a row at large text sizes', () => {
    r = render(WRAP_CHIPS_SCALE);
    expect(chipRow(r).flexWrap).toBe('wrap');
  });

  it('caps the From/To label and area pill so they keep sharing the top row', () => {
    r = render(2);
    const from = r.root.findAll((n) => n.props.children === 'From' && typeof n.type === 'string')[0];
    expect(from.props.maxFontSizeMultiplier).toBe(1.3);
    const pill = r.root.findAll((n) => n.props.accessibilityRole === 'switch')[0];
    const pillText = pill.findAll((n) => typeof n.type === 'string' && n.props.maxFontSizeMultiplier != null)[0];
    expect(pillText.props.maxFontSizeMultiplier).toBe(1.3);
  });
});

describe('SearchPanel main button (Q-063)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
  });

  const button = (label: string) =>
    r!.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        typeof n.type === 'string' &&
        String(n.props.accessibilityLabel).startsWith(label),
    )[0];
  const fill = (label: string) => StyleSheet.flatten(button(label).props.style).backgroundColor;
  const order = () =>
    r!.root
      .findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type === 'string')
      .map((n) => String(n.props.accessibilityLabel))
      .filter((l) => l === 'Find Routes' || l.startsWith('Get Home'));

  it('keeps Find Routes as the main button at home', () => {
    r = render(1);
    expect(button('Get Home')).toBeUndefined();
    expect(button('Find Routes')).toBeDefined();
  });

  it('makes Get Home the main button, above Find Routes, when away from home (John, 2026-10-30)', () => {
    r = render(1);
    const atHomeFind = fill('Find Routes');
    act(() => r!.unmount());
    r = render(1, { onGetHome: jest.fn(), homeName: 'Dallas' });
    expect(order()).toEqual(['Get Home: find routes to your main home, Dallas', 'Find Routes']);
    // It says where it goes before you tap it.
    expect(r.root.findAll((n) => n.props.children === 'Get Home · Dallas' && typeof n.type === 'string').length).toBe(1);
    expect(fill('Get Home')).toBe(atHomeFind);
    expect(fill('Find Routes')).not.toBe(atHomeFind);
  });
});

describe('SearchPanel empty-search notice', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
  });

  it('sits at the top, above the dates, so half height always shows it (design round 25)', () => {
    r = render(1, { onGetHome: jest.fn(), banner: <View testID="banner" /> });
    const ids = r.root
      .findAll((n) => typeof n.type === 'string' && (n.props.testID === 'banner' || n.props.testID === 'date-chips'))
      .map((n) => n.props.testID);
    expect(ids).toEqual(['banner', 'date-chips']);
  });
});

describe('SearchPanel first run (design round 39)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const texts = () =>
    r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
  const find = () => r!.root.findAll((n) => n.props.accessibilityLabel === 'Find Routes' && n.props.onPress)[0];

  it('says why Find Routes is off', () => {
    r = render(1, { origin: null });
    expect(find().props.accessibilityHint).toBe('Choose where you’re flying from first');
    act(() => r!.unmount());
    r = render(1, { origin: 'LAX', destination: 'LAX' });
    expect(find().props.accessibilityHint).toBe('From and To are the same airport');
    expect(texts()).toContain('From and To are the same airport. Change one to find routes.');
  });

  it('swaps with one side empty, moving it across; off only with both empty (John, 2026-11-01)', () => {
    const onSwap = jest.fn();
    const swapButton = () => r!.root.findAll((n) => n.props.accessibilityLabel === 'Swap from and to' && n.props.onPress)[0];
    r = render(1, { destination: null, onSwap });
    expect(swapButton().props.disabled).toBe(false);
    act(() => swapButton().props.onPress());
    expect(onSwap).toHaveBeenCalledTimes(1);
    act(() => r!.unmount());
    r = render(1, { origin: null, onSwap });
    expect(swapButton().props.disabled).toBe(false);
    act(() => r!.unmount());
    r = render(1, { origin: null, destination: null, onSwap });
    expect(swapButton().props.disabled).toBe(true);
    expect(swapButton().props.accessibilityHint).toBe('Choose an airport first');
  });

  it('tells the screen how tall it is down to Find Routes, so the drawer opens that far', () => {
    const onFitHeight = jest.fn();
    r = render(1, { onFitHeight });
    const row = r.root.findAll((n) => n.props.testID === 'search-actions' && typeof n.type === 'string')[0];
    act(() => row.props.onLayout({ nativeEvent: { layout: { x: 0, y: 300.4, width: 360, height: 52 } } }));
    expect(onFitHeight).toHaveBeenCalledWith(369);
  });

  it('shows what the empty From card is waiting on', () => {
    r = render(1, { origin: null, originEmptyText: 'Finding nearest airport…' });
    expect(texts()).toContain('Finding nearest airport…');
  });

  it('offers the main home as the way to Get Home', () => {
    const onSetHome = jest.fn();
    r = render(1, { onSetHome });
    const link = r.root.findAll((n) => n.props.accessibilityLabel === 'Set your main home to use Get Home' && n.props.onPress)[0];
    act(() => link.props.onPress());
    expect(onSetHome).toHaveBeenCalled();
  });
});

describe('SearchPanel empty sides (round 53)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
  });

  it('says what to do on an empty side, once, for VoiceOver too', () => {
    r = render(1, { destination: null, originEmptyText: 'Location is off. Choose airport', origin: null });
    const labels = r.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.onPress)
      .map((n) => n.props.accessibilityLabel as string);
    expect(labels).toContain('From: Location is off. Choose airport');
    expect(labels).toContain('To: choose an airport');
  });
});

describe('SearchPanel motion (John, 2026-11-01)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  // Lays the chips out in one row, 70pt wide with 8pt gaps; the calendar is 44pt.
  const layOut = () => {
    const chips = r!.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.accessibilityRole === 'button');
    const seen = new Set<string>();
    let x = 0;
    for (const n of chips) {
      const key = String(n.props.accessibilityLabel);
      if (seen.has(key)) continue;
      seen.add(key);
      const width = /later date/.test(key) ? 44 : 70;
      act(() => n.props.onLayout({ nativeEvent: { layout: { x, y: 0, width, height: 52 } } }));
      x += width + 8;
    }
  };
  const highlight = () => r!.root.findAll((n) => n.props.testID === 'date-highlight' && typeof n.type === 'string');

  it('the picked date highlight slides between chips once they are measured', () => {
    const chips = dateChips('2026-10-20');
    r = render(1);
    expect(highlight()).toHaveLength(0);
    layOut();
    expect(highlight()).toHaveLength(1);
    const timing = jest.spyOn(Animated, 'timing');
    act(() =>
      r!.update(
        <SearchPanel
          chips={chips}
          date={chips[2].date}
          onDate={jest.fn()}
          origin="DAL"
          destination="LAX"
          onPickOrigin={jest.fn()}
          onPickDestination={jest.fn()}
          onSwap={jest.fn()}
          areaOn={{}}
          onToggleArea={jest.fn()}
          onFilters={jest.fn()}
          filtersChanged={0}
          onFind={jest.fn()}
        />,
      ),
    );
    // Third chip: two chips and two gaps in.
    expect(timing.mock.calls.map((c) => (c[1] as { toValue: number }).toValue)).toContain(156);
  });

  it('no sliding highlight when the chips go two to a row', () => {
    r = render(WRAP_CHIPS_SCALE);
    layOut();
    expect(highlight()).toHaveLength(0);
  });

  it('a swap turns the button half a turn and slides both codes in from the other side', () => {
    const onSwap = jest.fn();
    r = render(1, { onSwap });
    const timing = jest.spyOn(Animated, 'timing');
    const swap = r.root.findAll((n) => n.props.accessibilityLabel === 'Swap from and to' && n.props.onPress)[0];
    act(() => swap.props.onPress());
    expect(onSwap).toHaveBeenCalledTimes(1);
    const calls = timing.mock.calls.map((c) => c[1] as { toValue: number; duration: number; useNativeDriver: boolean });
    // The turn, plus a slide and a fade for each card.
    expect(calls[0]).toMatchObject({ toValue: 1, duration: SWAP_MS, useNativeDriver: true });
    expect(calls.filter((c) => c.toValue === 0 && c.duration === SWAP_MS)).toHaveLength(2);
    const codes = r.root.findAll((n) => n.props.testID === 'card-code' && typeof n.type === 'string');
    expect(codes).toHaveLength(2);
    expect(SWAP_SLIDE).toBeGreaterThan(0);
  });
});
