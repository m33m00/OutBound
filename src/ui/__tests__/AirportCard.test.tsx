import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors } from '@/theme/colors';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AirportCard } from '../SearchPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const texts = (r: ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const textOf = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

describe('AirportCard area pill (Q-048, Q-056)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  function render(code: string, areaOn: boolean, onToggleArea = jest.fn()) {
    act(() => {
      r = create(<AirportCard label="From" code={code} onPress={jest.fn()} areaOn={areaOn} onToggleArea={onToggleArea} />);
    });
    return r!;
  }
  const pill = (t: ReactTestRenderer) => t.root.findAll((n) => n.props.accessibilityRole === 'switch')[0];

  it('reads "+ Area" in gray when off and "All Dallas" in blue when on, as a switch with a hint', () => {
    const toggle = jest.fn();
    const off = render('DFW', false, toggle);
    const p = pill(off);
    expect(p.props.accessibilityState).toEqual({ checked: false });
    expect(p.props.accessibilityLabel).toBe('Include all Dallas airports');
    expect(p.props.accessibilityHint).toBe('Searches DAL and DFW');
    expect(p.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
    expect(textOf(off)).toContain('Area');
    expect(textOf(off)).not.toContain('All Dallas');
    expect(StyleSheet.flatten(p.props.style({ pressed: false })).borderColor).toBe(colors.light.line2);
    expect(texts(off)).not.toContain('DAL · DFW');
    act(() => p.props.onPress());
    expect(toggle).toHaveBeenCalled();
    act(() => r?.unmount());

    const on = render('DFW', true);
    expect(pill(on).props.accessibilityState).toEqual({ checked: true });
    expect(StyleSheet.flatten(pill(on).props.style({ pressed: false })).backgroundColor).toBe(colors.light.accent);
    expect(textOf(on)).toContain('All Dallas');
    expect(texts(on)).toContain('DAL · DFW');
    expect(texts(on)).toContain('Dallas/Fort Worth');
  });

  it('has no pill for an airport without an area', () => {
    const t = render('BNA', true);
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'switch')).toHaveLength(0);
  });
});
