import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SAVED_ROUTES_KEY, type SavedRoute } from '../savedRoutes';
import { SavedRoutesProvider, useSavedRoutes } from '../SavedRoutesProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const route = (n: string): SavedRoute => ({
  key: `2026-10-20|AA${n}:DFW-LAX`,
  request: { origin: 'DFW', destination: 'LAX', date: '2026-10-20', originArea: false, destinationArea: false },
  legs: [{ airline: 'AA', flightNumber: n, from: 'DFW', to: 'LAX', departUtc: 1, arriveUtc: 2 }],
  savedAt: 0,
});

let ctx: ReturnType<typeof useSavedRoutes>;
function Probe() {
  ctx = useSavedRoutes();
  return null;
}

describe('SavedRoutesProvider', () => {
  let r: ReactTestRenderer | undefined;
  beforeEach(() => AsyncStorage.clear());
  afterEach(() => act(() => r?.unmount()));

  const mount = async () => {
    await act(async () => {
      r = create(
        <SavedRoutesProvider>
          <Probe />
        </SavedRoutesProvider>,
      );
    });
  };
  const stored = async () => JSON.parse((await AsyncStorage.getItem(SAVED_ROUTES_KEY)) ?? '[]') as SavedRoute[];

  it('loads saved routes from the phone and saves every change', async () => {
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify([route('1')]));
    await mount();
    expect(ctx.loaded).toBe(true);
    expect(ctx.routes.map((x) => x.key)).toEqual([route('1').key]);
    expect(ctx.isSaved(route('1').key)).toBe(true);
    await act(async () => ctx.save(route('2')));
    expect((await stored()).map((x) => x.key)).toEqual([route('1').key, route('2').key]);
    await act(async () => ctx.remove(route('1').key));
    expect((await stored()).map((x) => x.key)).toEqual([route('2').key]);
    expect(ctx.isSaved(route('1').key)).toBe(false);
  });

  it('keeps a save made before the phone was read', async () => {
    await AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify([route('1')]));
    let release!: () => void;
    const getItem = AsyncStorage.getItem as jest.Mock;
    const real = getItem.getMockImplementation();
    getItem.mockImplementationOnce(
      (key: string) => new Promise((done) => (release = () => done(real!(key)))) as Promise<string | null>,
    );
    await mount();
    expect(ctx.loaded).toBe(false);
    act(() => ctx.save(route('2')));
    await act(async () => release());
    await act(async () => {});
    expect(ctx.routes.map((x) => x.key)).toEqual([route('1').key, route('2').key]);
    expect((await stored()).map((x) => x.key)).toEqual([route('1').key, route('2').key]);
  });

  it('hands a route from My Trips to Search once', async () => {
    await mount();
    act(() => ctx.open(route('3')));
    expect(ctx.opening?.key).toBe(route('3').key);
    act(() => ctx.clearOpening());
    expect(ctx.opening).toBeNull();
  });
});
