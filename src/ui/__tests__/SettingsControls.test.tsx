import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AppearanceChoice, ListSwitchRow } from '../SettingsControls';

const pressable = (r: ReactTestRenderer, testID: string) =>
  r.root.findAll((n) => n.props.testID === testID && typeof n.props.onPress === 'function')[0];

describe('Settings tab controls (round 174)', () => {
  it('a switch row flips its setting from anywhere on the row', () => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<ListSwitchRow testID="row" label="Rain radar" value={false} onChange={onChange} icon="cloud.rain" />);
    });
    const row = pressable(r, 'row');
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityState).toEqual({ checked: false });
    act(() => row.props.onPress());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('appearance offers Light, Dark and System and reports the pick', () => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<AppearanceChoice value="system" onChange={onChange} />);
    });
    expect(pressable(r, 'appearance-choice-system').props.accessibilityState).toEqual({ checked: true });
    act(() => pressable(r, 'appearance-choice-dark').props.onPress());
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
