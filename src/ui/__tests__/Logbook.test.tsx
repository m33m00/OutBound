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

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

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
    mockFontScale = 1;
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

  it('moves through the boxes from the keyboard and adds from the last one', async () => {
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    expect(['Airline', 'Flight', 'From', 'To'].map((l) => field(l).props.returnKeyType)).toEqual(['next', 'next', 'next', 'next']);
    const toFocus = jest.fn();
    const to = field('To');
    // A full From code moves on to To by itself.
    const inst = r!.root.findAll((n) => n.props.accessibilityLabel === 'To' && n.instance?.focus);
    inst.forEach((n) => (n.instance.focus = toFocus));
    act(() => field('From').props.onChangeText('dfw'));
    expect(toFocus).toHaveBeenCalled();
    expect(to.props.placeholder).toBe('LAX');
    act(() => field('Airline').props.onChangeText('AA'));
    act(() => field('Flight').props.onChangeText('1234'));
    act(() => field('To').props.onChangeText('LAX'));
    expect(field('Seat (optional)').props.returnKeyType).toBe('go');
    await act(async () => field('Seat (optional)').props.onSubmitEditing());
    expect(await stored()).toHaveLength(1);
  });

  it('puts the boxes one per line at big text', async () => {
    const rowOf = (label: string) => {
      let n = field(label).parent;
      while (n && !(n.props.style && [n.props.style].flat(3).some((x: { flexDirection?: string }) => x?.flexDirection === 'row'))) n = n.parent;
      return [n!.props.style].flat(3).reduce((a: object, x: object) => ({ ...a, ...x }), {}) as { flexDirection?: string };
    };
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    expect(rowOf('Airline').flexDirection).toBe('row');
    act(() => r!.unmount());
    mockFontScale = 1.5;
    await mount();
    await act(async () => button('Add Flight').props.onPress());
    expect(rowOf('Airline').flexDirection).toBe('column');
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

  it('opens a logged flight to fix it, in the same place', async () => {
    const logged = (n: string, from: string, to: string, addedAt: number): LoggedFlight => ({
      id: `2026-10-29|AA${n}:${from}-${to}`,
      airline: 'AA',
      flightNumber: n,
      from,
      to,
      date: '2026-10-29',
      source: 'scan',
      addedAt,
    });
    await AsyncStorage.setItem(LOGBOOK_KEY, JSON.stringify([logged('1', 'DFW', 'LAX', 1), logged('2', 'LAX', 'DFW', 2)]));
    await mount();
    const rows = r!.root.findAllByProps({ testID: 'edit-logged-flight' }).filter((n) => typeof n.type !== 'string' && n.props.onPress);
    expect(rows[1].props.accessibilityHint).toBe('Opens it to fix the details');
    await act(async () => rows[1].props.onPress());
    expect(texts()).toContain('Edit Flight');
    expect(texts()).not.toContain('Scan Boarding Pass');
    expect(field('From').props.value).toBe('DFW');
    // Changing it into the other logged flight isn't allowed.
    act(() => field('Flight').props.onChangeText('2'));
    act(() => field('From').props.onChangeText('LAX'));
    act(() => field('To').props.onChangeText('DFW'));
    expect(button('Save Changes').props.disabled).toBe(true);
    expect(texts()).toContain('This flight is already in your logbook.');
    act(() => field('Flight').props.onChangeText('1'));
    act(() => field('To').props.onChangeText('SAN'));
    act(() => field('Seat (optional)').props.onChangeText('4F'));
    await act(async () => button('Save Changes').props.onPress());
    expect((await stored()).map((f) => `${f.id} ${f.seat ?? '-'} ${f.addedAt} ${f.source}`)).toEqual([
      '2026-10-29|AA1:LAX-SAN 4F 1 scan',
      '2026-10-29|AA2:LAX-DFW - 2 scan',
    ]);
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
