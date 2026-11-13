import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import TripsScreen from '@/app/(tabs)/trips';
import { RequestsProvider } from '@/requests/RequestsProvider';
import { SAVED_ROUTES_KEY, type SavedRoute } from '@/trips/savedRoutes';
import { SavedRoutesProvider } from '@/trips/SavedRoutesProvider';

import { swipeOutcome, DELETE_W } from '../SwipeToDelete';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]), router: { navigate: jest.fn() } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LATER = Date.now() + 2 * 24 * 3600_000;
const route = (n: string): SavedRoute => ({
  key: `2099-01-01|AA${n}:DFW-LAX`,
  request: { origin: 'DFW', destination: 'LAX', date: '2099-01-01', originArea: false, destinationArea: false },
  legs: [{ airline: 'AA', flightNumber: n, from: 'DFW', to: 'LAX', departUtc: LATER, arriveUtc: LATER + 3 * 3600_000 }],
  savedAt: 0,
});

describe('My Trips (round 167)', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => AsyncStorage.clear());
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  const mount = async () => {
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify([route('1'), route('2')]));
    await act(async () => {
      r = create(
        <SavedRoutesProvider>
          <RequestsProvider>
            <TripsScreen />
          </RequestsProvider>
        </SavedRoutesProvider>,
      );
    });
  };
  const host = (id: string) => r!.root.findAll((n) => typeof n.type === 'string' && n.props.testID === id);
  const press = (id: string) => {
    const n = r!.root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[0];
    act(() => n.props.onPress());
  };
  const pressAt = (id: string, i: number) => {
    const n = r!.root.findAll((x) => x.props.testID === id && typeof x.props.onPress === 'function')[i];
    act(() => n.props.onPress());
  };
  const blocks = () => [...host('request-route'), ...host('request-flights')];
  const requestRows = () => r!.root.findAll((n) => typeof n.type !== 'string' && n.props.request && n.props.mine);
  const stored = async () =>
    (JSON.parse((await AsyncStorage.getItem(SAVED_ROUTES_KEY)) ?? '[]') as SavedRoute[]).map((x) => x.key);

  it('splits Your requests and Saved routes with their own headers and counts', async () => {
    await mount();
    expect(host('requests-header')).toHaveLength(1);
    const saved = r!.root.find((n) => n.props.testID === 'saved-header' && n.props.rule !== undefined);
    expect(saved.props.count).toBe(2);
    expect(saved.props.rule).toBe(true);
  });

  it('a swipe-delete takes a route off, with Undo to bring it back', async () => {
    await mount();
    // Requests swipe too since round 195; the saved routes' swipes come after them.
    const reqs = blocks().length;
    expect(host('swipe-to-delete')).toHaveLength(reqs + 2);
    jest.useFakeTimers();
    pressAt('swipe-delete', reqs);
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    expect(await stored()).toEqual([route('2').key]);
    expect(host('deleted-toast')).toHaveLength(1);
    press('deleted-toast-undo');
    await act(async () => {});
    expect((await stored()).sort()).toEqual([route('1').key, route('2').key]);
  });

  it('Select picks routes and deletes them after a confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await mount();
    press('select-saved');
    expect(host('saved-select-row')).toHaveLength(2);
    expect(host('remove-saved-route')).toHaveLength(0);
    expect(host('select-bar')).toHaveLength(1);
    press('select-all');
    expect(host('saved-checked')).toHaveLength(2);
    const del = r!.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityLabel === 'Delete 2' && n.props.onPress);
    await act(async () => del.props.onPress());
    expect(alert).toHaveBeenCalledWith('Delete 2 saved routes?', expect.any(String), expect.any(Array));
    expect(await stored()).toEqual([]);
  });

  it('swipes a request off My Trips, with Undo to bring it back (round 195, John: "I can\'t delete those")', async () => {
    await mount();
    const before = requestRows().length;
    expect(before).toBeGreaterThan(0);
    jest.useFakeTimers();
    pressAt('swipe-delete', 0);
    await act(async () => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    expect(requestRows().length).toBeLessThan(before);
    expect(host('request-deleted-toast')).toHaveLength(1);
    press('request-deleted-toast-undo');
    await act(async () => {});
    expect(requestRows()).toHaveLength(before);
  });

  it('Select on Your requests picks requests and deletes them after a confirm (round 195)', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await mount();
    const n = blocks().length;
    press('select-requests');
    expect(host('request-select-row')).toHaveLength(n);
    // Saved routes' Select steps aside while requests are being picked.
    expect(host('select-saved')).toHaveLength(0);
    press('select-all');
    expect(host('select-checked')).toHaveLength(n);
    const del = r!.root.find(
      (x) => typeof x.type !== 'string' && x.props.accessibilityLabel === `Delete ${n}` && x.props.onPress,
    );
    await act(async () => del.props.onPress());
    expect(alert).toHaveBeenCalledWith(
      expect.stringMatching(/^Delete \d+ (requests?|routes?)\?$/),
      expect.any(String),
      expect.any(Array),
    );
    expect(requestRows()).toHaveLength(0);
    expect(host('request-deleted-toast')).toHaveLength(1);
    // Saved routes are untouched.
    expect((await stored()).sort()).toEqual([route('1').key, route('2').key]);
  });
});

describe('swipeOutcome', () => {
  it('snaps back, opens on Delete, or deletes on a long swipe or a hard flick', () => {
    expect(swipeOutcome(-10, 0, 360)).toBe('close');
    expect(swipeOutcome(-DELETE_W / 2 - 1, 0, 360)).toBe('open');
    expect(swipeOutcome(-0.6 * 360, 0, 360)).toBe('delete');
    expect(swipeOutcome(-DELETE_W - 10, -2000, 360)).toBe('delete');
    expect(swipeOutcome(-DELETE_W + 10, -2000, 360)).toBe('open');
  });
});

describe('Requests tab badge (round 167)', () => {
  it('counts the asks still waiting for your answer', async () => {
    const { useRequests, feedAsks } = jest.requireActual(
      '@/requests/RequestsProvider',
    ) as typeof import('@/requests/RequestsProvider');
    let ctx!: ReturnType<typeof useRequests>;
    const Probe = () => {
      ctx = useRequests();
      return null;
    };
    let r: ReactTestRenderer | undefined;
    await act(async () => {
      r = create(
        <RequestsProvider>
          <Probe />
        </RequestsProvider>,
      );
    });
    const now = Date.now();
    const asks = feedAsks(now);
    expect(ctx.openFeedCount(now)).toBe(asks.length);
    await act(async () => ctx.answerFeed(asks[0].id, { open: 3, listed: 1, at: now, byYou: true }));
    expect(ctx.openFeedCount(now)).toBe(asks.length - 1);
    act(() => r?.unmount());
  });
});
