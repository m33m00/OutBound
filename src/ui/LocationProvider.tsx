import { createContext, useContext, type ReactNode } from 'react';

import { useSettings } from '@/settings/SettingsProvider';

import { useCurrentLocation, type SharedLocation } from './useCurrentLocation';

const LocationContext = createContext<SharedLocation | null>(null);

/**
 * One phone location for the whole app (Q-051): the leave-by card, the
 * default origin and the Settings toggle all read the same fix and timestamp.
 * Must sit inside SettingsProvider (follows settings.useLocation).
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const value = useCurrentLocation(settings.useLocation);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useSharedLocation(): SharedLocation {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useSharedLocation must be used inside LocationProvider');
  return ctx;
}
