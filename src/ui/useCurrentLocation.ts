import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { LOCATION_FRESH_MS, type PhoneLocation } from '@/search/leaveBy';
import type { LocationPermission } from '@/search/origin';

export type LocationStatus = 'off' | 'idle' | 'locating' | 'denied' | 'error';

const permissionOf = (p: Location.PermissionResponse): LocationPermission =>
  p.granted ? 'granted' : p.status === 'undetermined' ? 'undetermined' : 'denied';

/**
 * Phone location (Q-023, Q-051). Never prompts on its own: the permission
 * prompt appears only from `request()` (a user tap). When `enabled` and
 * permission is already granted, it re-reads a fix older than 20 min on
 * mount and each time the app comes back to the foreground.
 *
 * The app's one location reader: LocationProvider calls it once so the
 * leave-by card and the default origin share the same fix. Screens use
 * `useSharedLocation()`, not this.
 */
export function useCurrentLocation(enabled: boolean) {
  const [location, setLocation] = useState<PhoneLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>(enabled ? 'idle' : 'off');
  const [permission, setPermission] = useState<LocationPermission>('unknown');
  // Latest fix for the stale check in the AppState listener; one read at a time.
  const fix = useRef<PhoneLocation | null>(null);
  const reading = useRef(false);

  const read = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    setStatus('locating');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      fix.current = { lat: pos.coords.latitude, lon: pos.coords.longitude, at: pos.timestamp };
      setLocation(fix.current);
      setStatus('idle');
    } catch {
      setStatus('error');
    } finally {
      reading.current = false;
    }
  }, []);

  /** Ask for permission (shows the iOS prompt the first time), then read. */
  const request = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setPermission(permissionOf(res));
    if (!res.granted) {
      setStatus('denied');
      return false;
    }
    await read();
    return true;
  }, [read]);

  useEffect(() => {
    if (!enabled) setStatus('off');
    let alive = true;
    // Checking permission never prompts; it also tells the launch card whether to show.
    const check = async () => {
      try {
        const res = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        setPermission(permissionOf(res));
        if (!enabled) return;
        if (!res.granted) setStatus('idle');
        else if (!fix.current || Date.now() - fix.current.at > LOCATION_FRESH_MS) read();
      } catch {
        // Permission unreadable: leave things as they are.
      }
    };
    check();
    // Back in the foreground: same check (permission may have changed in iPhone Settings).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [enabled, read]);

  return useMemo(() => ({ location, status, permission, request }), [location, status, permission, request]);
}

export type SharedLocation = ReturnType<typeof useCurrentLocation>;
