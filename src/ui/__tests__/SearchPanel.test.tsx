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

function render(fontScale: number) {
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
