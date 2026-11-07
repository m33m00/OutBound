import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DEFAULT_FILTERS, type SearchFilters } from '@/settings/settings';

import { airlineChoices, FiltersForm, hourLabel, timeWindowText } from '../FiltersForm';

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
  const has = (testID: string) => r.root.findAll((n) => n.props.testID === testID).length > 0;
  return { r, onChange, press, has };
}

describe('Filters, round 174', () => {
  it('labels times of day on the 12-hour clock', () => {
    expect(hourLabel(0)).toBe('12 AM');
    expect(hourLabel(5 * 60)).toBe('5 AM');
    expect(hourLabel(12 * 60)).toBe('12 PM');
    expect(hourLabel(21 * 60)).toBe('9 PM');
    expect(timeWindowText('morning')).toBe('5 AM to 12 PM');
    expect(timeWindowText('night')).toBe('9 PM to 5 AM');
  });

  it('turns a time of day on and off, keeping the day in order', () => {
    const { onChange, press } = render({ ...DEFAULT_FILTERS, departTimes: ['night'] });
    press('filters-time-morning');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ departTimes: ['morning', 'night'] }));
    press('filters-time-night');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ departTimes: [] }));
  });

  it('US airlines hides foreign airlines and drops them from the picks', () => {
    expect(airlineChoices('all')).toContain('AC');
    expect(airlineChoices('us')).not.toContain('AC');
    const { onChange, press, has } = render({ ...DEFAULT_FILTERS, airlines: ['AC', 'WN'] });
    expect(has('filters-airline-AC')).toBe(true);
    press('filters-region-us');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ airlineRegion: 'us', airlines: ['WN'] }));
    expect(render({ ...DEFAULT_FILTERS, airlineRegion: 'us' }).has('filters-airline-AC')).toBe(false);
  });

  it('picks and unpicks an airline', () => {
    const { onChange, press } = render(DEFAULT_FILTERS);
    press('filters-airline-WN');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ airlines: ['WN'] }));
    const again = render({ ...DEFAULT_FILTERS, airlines: ['WN'] });
    again.press('filters-airline-WN');
    expect(again.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ airlines: [] }));
  });

  it('switches only answered loads', () => {
    const { onChange, press } = render(DEFAULT_FILTERS);
    press('filters-answered');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ answeredOnly: true }));
  });

  it('removes an avoided airport from its pill', () => {
    const { onChange, press, has } = render({ ...DEFAULT_FILTERS, avoidAirports: ['ORD', 'ATL'] });
    expect(has('filters-avoid-add')).toBe(true);
    press('filters-avoid-ORD');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ avoidAirports: ['ATL'] }));
  });
});
