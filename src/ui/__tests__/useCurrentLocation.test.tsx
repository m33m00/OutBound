import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { LOCATION_FRESH_MS } from '@/search/leaveBy';

import { useCurrentLocation, type SharedLocation } from '../useCurrentLocation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No live location: every expo-location call is a mock.
const mockPermission = { current: { granted: true, status: 'granted' } };
const mockGetPosition = jest.fn();
const mockRequest = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: () => Promise.resolve(mockPermission.current),
  requestForegroundPermissionsAsync: () => mockRequest(),
  getCurrentPositionAsync: () => mockGetPosition(),
}));

let appStateListener: ((s: string) => void) | null = null;
jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
  appStateListener = fn as (s: string) => void;
  return { remove: () => (appStateListener = null) } as ReturnType<typeof AppState.addEventListener>;
});

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

describe('useCurrentLocation (Q-023, Q-051)', () => {
  let r: ReactTestRenderer | undefined;
  let out!: SharedLocation;
  let now = Date.UTC(2026, 9, 21, 15);

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockGetPosition.mockReset().mockImplementation(() =>
      Promise.resolve({ coords: { latitude: 36.16, longitude: -86.78 }, timestamp: now }),
    );
    mockRequest.mockReset();
    mockPermission.current = { granted: true, status: 'granted' };
  });
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  async function render(enabled: boolean) {
    function C() {
      out = useCurrentLocation(enabled);
      return null;
    }
    act(() => {
      r = create(<C />);
    });
    await flush();
  }

  it('reads a fix on app open when on and granted, without prompting', async () => {
    await render(true);
    expect(mockGetPosition).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(out.location).toEqual({ lat: 36.16, lon: -86.78, at: now });
    expect(out.permission).toBe('granted');
  });

  it('re-reads on return to the foreground only when the fix is older than 20 min', async () => {
    await render(true);
    now += LOCATION_FRESH_MS - 60_000;
    appStateListener?.('active');
    await flush();
    expect(mockGetPosition).toHaveBeenCalledTimes(1);
    now += 2 * 60_000;
    appStateListener?.('active');
    await flush();
    expect(mockGetPosition).toHaveBeenCalledTimes(2);
    expect(out.location?.at).toBe(now);
  });

  it('never reads or prompts when off, but still reports the permission', async () => {
    mockPermission.current = { granted: false, status: 'undetermined' };
    await render(false);
    appStateListener?.('active');
    await flush();
    expect(mockGetPosition).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(out.permission).toBe('undetermined');
    expect(out.status).toBe('off');
  });

  it('request() prompts, and a denial reports denied', async () => {
    mockPermission.current = { granted: false, status: 'undetermined' };
    mockRequest.mockResolvedValue({ granted: false, status: 'denied' });
    await render(false);
    let granted: boolean | undefined;
    await act(async () => {
      granted = await out.request();
    });
    expect(granted).toBe(false);
    expect(out.permission).toBe('denied');
    expect(out.status).toBe('denied');
  });
});
