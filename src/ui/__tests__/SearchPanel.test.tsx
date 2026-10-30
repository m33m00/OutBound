import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { dateChips } from '@/search/dates';

import { SearchPanel, WRAP_CHIPS_SCALE } from '../SearchPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

function render(fontScale: number, extra: { onGetHome?: () => void } = {}) {
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
    r!.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type === 'string' && String(n.props.accessibilityLabel).startsWith(label))[0];
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
    r = render(1, { onGetHome: jest.fn() });
    expect(order()).toEqual(['Get Home: search to your main home', 'Find Routes']);
    expect(fill('Get Home')).toBe(atHomeFind);
    expect(fill('Find Routes')).not.toBe(atHomeFind);
  });
});
