import React from 'react';
import { Appearance, Text } from 'react-native';
import * as RN from 'react-native';
import { act, create } from 'react-test-renderer';

import { applyAppearance, getAppearancePref, parseAppearance } from '../appearance';
import { colors } from '../colors';
import { useColors, useColorSchemeName } from '../index';

function Probe() {
  const scheme = useColorSchemeName();
  const c = useColors();
  return <Text testID="probe">{`${scheme} ${c.bg}`}</Text>;
}

const read = (r: ReturnType<typeof create>) => r.root.findByProps({ testID: 'probe' }).props.children as string;

describe('Appearance: Light, Dark or System (round 173)', () => {
  let phone: 'light' | 'dark' = 'light';
  let setSpy: jest.SpyInstance;

  beforeEach(() => {
    phone = 'light';
    jest.spyOn(RN, 'useColorScheme').mockImplementation(() => phone);
    setSpy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => applyAppearance('system'));
    jest.restoreAllMocks();
  });

  it('defaults to System and reads anything unknown as System', () => {
    expect(getAppearancePref()).toBe('system');
    expect(parseAppearance(undefined)).toBe('system');
    expect(parseAppearance('Dark')).toBe('system');
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('light')).toBe('light');
  });

  it('System follows the phone', () => {
    phone = 'dark';
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe />);
    });
    expect(read(r)).toBe(`dark ${colors.dark.bg}`);
  });

  it('Light and Dark win over the phone and redraw at once', () => {
    phone = 'dark';
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe />);
    });
    act(() => applyAppearance('light'));
    expect(read(r)).toBe(`light ${colors.light.bg}`);
    phone = 'light';
    act(() => applyAppearance('dark'));
    expect(read(r)).toBe(`dark ${colors.dark.bg}`);
    act(() => applyAppearance('system'));
    expect(read(r)).toBe(`light ${colors.light.bg}`);
  });

  it("sets the phone's own parts (keyboard, alerts, pickers) to match, and clears that for System", () => {
    applyAppearance('dark');
    expect(setSpy).toHaveBeenLastCalledWith('dark');
    applyAppearance('light');
    expect(setSpy).toHaveBeenLastCalledWith('light');
    applyAppearance('system');
    expect(setSpy).toHaveBeenLastCalledWith('unspecified');
    const calls = setSpy.mock.calls.length;
    applyAppearance('system');
    expect(setSpy.mock.calls.length).toBe(calls);
  });

  it('still draws the choice if the phone override throws', () => {
    setSpy.mockImplementation(() => {
      throw new Error('no override here');
    });
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe />);
    });
    act(() => applyAppearance('dark'));
    expect(read(r)).toBe(`dark ${colors.dark.bg}`);
  });
});
