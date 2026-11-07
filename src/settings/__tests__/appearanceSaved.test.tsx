import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Appearance, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { applyAppearance, getAppearancePref } from '@/theme/appearance';

import { readSavedAppearance, SettingsProvider, useSettings } from '../SettingsProvider';
import { SETTINGS_KEY } from '../settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let api: ReturnType<typeof useSettings> | null = null;
function Grab() {
  api = useSettings();
  return <Text>{api.settings.appearance}</Text>;
}

const flush = () => act(async () => {});

describe('saved Appearance (round 173)', () => {
  beforeEach(async () => {
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    await AsyncStorage.clear();
    api = null;
  });
  afterEach(() => {
    act(() => applyAppearance('system'));
    jest.restoreAllMocks();
  });

  it('reads the saved choice before the app draws, System when nothing is saved or it is unreadable', async () => {
    expect(await readSavedAppearance()).toBe('system');
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ appearance: 'dark' }));
    expect(await readSavedAppearance()).toBe('dark');
    await AsyncStorage.setItem(SETTINGS_KEY, '{not json');
    expect(await readSavedAppearance()).toBe('system');
  });

  it('applies the saved choice once settings load, and saves a new pick', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ appearance: 'light' }));
    act(() => {
      create(
        <SettingsProvider>
          <Grab />
        </SettingsProvider>,
      );
    });
    await flush();
    expect(getAppearancePref()).toBe('light');
    act(() => api!.update({ appearance: 'dark' }));
    await flush();
    expect(getAppearancePref()).toBe('dark');
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!).appearance).toBe('dark');
    act(() => api!.reset());
    await flush();
    expect(getAppearancePref()).toBe('system');
  });
});
