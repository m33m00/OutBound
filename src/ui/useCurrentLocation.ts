import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { LOCATION_FRESH_MS, type PhoneLocation } from '@/search/leaveBy';

export type LocationStatus = 'off' | 'idle' | 'locating' | 'denied' | 'error';

/**
 * Phone location for the leave-by card (Q-023). Never prompts on its own:
 * the permission prompt appears only from `request()` (a user tap). When
 * `enabled` and permission is already granted, it refreshes a stale fix.
 */
export function useCurrentLocation(enabled: boolean) {
  const [location, setLocation] = useState<PhoneLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>(enabled ? 'idle' : 'off');

  const read = useCallback(async () => {
    setStatus('locating');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, at: pos.timestamp });
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  /** Ask for permission (shows the iOS prompt the first time), then read. */
  const request = useCallback(async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setStatus('denied');
      return false;
    }
    await read();
    return true;
  }, [read]);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    let alive = true;
    Location.getForegroundPermissionsAsync().then(({ granted }) => {
      if (!alive) return;
      if (!granted) setStatus('idle');
      else if (!location || Date.now() - location.at > LOCATION_FRESH_MS) read();
    });
    return () => {
      alive = false;
    };
    // Re-check when turned on; a stale fix refreshes on the next card mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, read]);

  return { location, status, request };
}
