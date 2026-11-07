import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { DEFAULT_APPEARANCE, type AppearancePref } from './appearancePref';

export { APPEARANCE_LABEL, APPEARANCE_PREFS, DEFAULT_APPEARANCE, parseAppearance, type AppearancePref } from './appearancePref';

/**
 * The app's Light / Dark / System choice. One value for the whole app: every screen reads it
 * through useColorSchemeName, and the phone's own parts (keyboard, alerts, pickers) follow it
 * through Appearance.setColorScheme. System removes the override and follows the phone.
 */
let current: AppearancePref = DEFAULT_APPEARANCE;
const listeners = new Set<() => void>();

export function getAppearancePref(): AppearancePref {
  return current;
}

export function applyAppearance(pref: AppearancePref): void {
  if (pref === current) return;
  current = pref;
  try {
    // 'unspecified' clears the override on iOS and Android alike.
    Appearance.setColorScheme?.(pref === 'system' ? 'unspecified' : pref);
  } catch {
    // A platform without the override (web, tests) still draws from `current`.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppearancePref(): AppearancePref {
  return useSyncExternalStore(subscribe, getAppearancePref, getAppearancePref);
}
