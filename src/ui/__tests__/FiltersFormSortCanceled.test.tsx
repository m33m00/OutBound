import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { changedFilters, changedSearchFilters, DEFAULT_FILTERS, type SearchFilters } from '@/settings/settings';

import { FiltersForm, SORT_CAPTION } from '../FiltersForm';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function render(filters: SearchFilters) {
  const onChange = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<FiltersForm filters={filters} onChange={onChange} />);
  });
  const press = (testID: string) =>
    act(() => {
      r.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0].props.onPress();
    });
  const text = (testID: string) =>
    r.root.findAll((n) => n.props.testID === testID && typeof n.props.children === 'string')[0]?.props.children;
  return { r, onChange, press, text };
}

describe('Filters: Sort by and Canceled flights (Jayden, 2026-11-13)', () => {
  it('offers Departure, Most seats and Arrival, with Departure picked by default', () => {
    const { r, text } = render(DEFAULT_FILTERS);
    const picked = (id: string) =>
      r.root.findAll((n) => n.props.testID === `filters-sort-${id}` && n.props.accessibilityState)[0].props.accessibilityState
        .checked;
    expect(picked('departure')).toBe(true);
    expect(picked('seats')).toBe(false);
    expect(picked('arrival')).toBe(false);
    expect(text('filters-sort-caption')).toBe(SORT_CAPTION.departure);
  });

  it('picks a sort order', () => {
    const { onChange, press } = render(DEFAULT_FILTERS);
    press('filters-sort-seats');
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, sortBy: 'seats' });
    press('filters-sort-arrival');
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, sortBy: 'arrival' });
  });

  it('turns canceled routes on and off', () => {
    const { onChange, press } = render(DEFAULT_FILTERS);
    press('filters-canceled');
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, showCanceled: true });
    const again = render({ ...DEFAULT_FILTERS, showCanceled: true });
    again.press('filters-canceled');
    expect(again.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, showCanceled: false });
  });

  it('count as changed filters, but never make the search run again', () => {
    const picked = { ...DEFAULT_FILTERS, sortBy: 'seats' as const, showCanceled: true };
    expect(changedFilters(picked)).toBe(2);
    expect(changedSearchFilters(picked, DEFAULT_FILTERS)).toBe(0);
    expect(changedSearchFilters({ ...picked, maxStops: 1 }, DEFAULT_FILTERS)).toBe(1);
  });
});
