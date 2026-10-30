import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import LogbookScreen from '@/app/(tabs)/logbook';
import { LOGBOOK_KEY, type LoggedFlight } from '@/logbook/logbook';
import { LogbookProvider } from '@/logbook/LogbookProvider';

import { PHOTO_MISS_IOS } from '../AddFlightSheet';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});
const mockScan = jest.fn();
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  scanFromURLAsync: (...args: unknown[]) => mockScan(...args),
}));
const mockPick = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...args: unknown[]) => mockPick(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PASS = `M1${'YAGER/JOHN'.padEnd(20)}EABC123 DFWLAXAA 1234 303Y012C0025 100`;

describe('Logbook tab', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockScan.mockReset();
    mockPick.mockReset();
    jest.useFakeTimers({ now: Date.UTC(2026, 9, 30, 18), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  });
  afterEach(() => {
    act(() => r?.unmount());
    jest.useRealTimers();
  });

  const mount = async () => {
    await act(async () => {
      r = create(
        <LogbookProvider>
          <LogbookScreen />
        </LogbookProvider>,
      );
    });
  };
  const texts = () =>
    r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children as string);
  const button = (label: string) =>
    r!.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label);
  const field = (label: string) => r!.root.find((n) => n.type === TextInput && n.props.accessibilityLabel === label);
  const stored = async () => JSON.parse((await AsyncStorage.getItem(LOGBOOK_KEY)) ?? '[]') as LoggedFlight[];

  it('starts empty, then logs a typed flight and shows totals', async () => {
    await mount();
    expect(texts()).toContain('No flights logged yet');
    await act(async () => button('Add Flight').props.onPress());
    const add = () => button('Add to Logbook');
    expect(add().props.disabled).toBe(true);
    act(() => field('Airline').props.onChangeText('aa'));
    act(() => field('Flight').props.onChangeText('1234'));
    act(() => field('From').props.onChangeText('dfw'));
    act(() => field('To').props.onChangeText('la'));
    expect(texts()).toContain('Add where you flew to, like LAX.');
    act(() => field('To').props.onChangeText('lax'));
    act(() => field('Seat (optional)').props.onChangeText('12a'));
    expect(add().props.disabled).toBe(false);
    await act(async () => add().props.onPress());
    expect(await stored()).toEqual([
      expect.objectContaining({ airline: 'AA', flightNumber: '1234', from: 'DFW', to: 'LAX', date: '2026-10-30', seat: '12A', source: 'manual' }),
    ]);
    expect(r!.root.findByProps({ testID: 'logbook-totals' }).props.accessibilityLabel).toMatch(/^1 flight, 1,2\d\d miles, 2 airports$/);
    expect(texts()).toEqual(expect.arrayContaining(['DFW → LAX', 'Today · Seat 12A', 'OCTOBER 2026']));
  });

  it('won’t log the same flight twice, and asks before removing one', async () => {
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    act(() => field('Airline').props.onChangeText('AA'));
    act(() => field('Flight').props.onChangeText('1234'));
    act(() => field('From').props.onChangeText('DFW'));
    act(() => field('To').props.onChangeText('LAX'));
    await act(async () => button('Add to Logbook').props.onPress());
    await act(async () => button('Add Flight').props.onPress());
    act(() => field('Airline').props.onChangeText('AA'));
    act(() => field('Flight').props.onChangeText('1234'));
    act(() => field('From').props.onChangeText('DFW'));
    act(() => field('To').props.onChangeText('LAX'));
    expect(button('Add to Logbook').props.disabled).toBe(true);
    expect(texts()).toContain('This flight is already in your logbook.');
    act(() => button('Cancel').props.onPress());

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    act(() => r!.root.findByProps({ testID: 'remove-logged-flight' }).props.onPress());
    expect(alert.mock.calls[0][0]).toBe('Remove DFW → LAX?');
    const remove = (alert.mock.calls[0][2] ?? []).find((b) => b.text === 'Remove');
    await act(async () => remove?.onPress?.());
    expect(await stored()).toEqual([]);
    alert.mockRestore();
  });

  it('fills the form from a screenshot of a pass, without the name', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://pass.png' }] });
    mockScan.mockResolvedValue([{ type: 'pdf417', data: PASS }]);
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    await act(async () => button('Choose Screenshot').props.onPress());
    expect(field('From').props.value).toBe('DFW');
    expect(field('Seat (optional)').props.value).toBe('12C');
    expect(texts()).toContain('Read your boarding pass. Check it, then add it.');
    await act(async () => button('Add to Logbook').props.onPress());
    const [saved] = await stored();
    expect(saved.source).toBe('photo');
    expect(JSON.stringify(saved)).not.toMatch(/YAGER|ABC123/);
  });

  it('says what to do when a screenshot can’t be read', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://pass.png' }] });
    mockScan.mockResolvedValue([]);
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    await act(async () => button('Choose Screenshot').props.onPress());
    expect(r!.root.findByProps({ testID: 'add-flight-note' }).props.children).toBe(PHOTO_MISS_IOS);
  });
});
