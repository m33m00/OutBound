import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { DEFAULT_APPEARANCE, type AppearancePref } from './appearancePref';

export { APPEARANCE_LABEL, APPEARANCE_PREFS, DEFAULT_APPEARANCE, parseAppearance, type AppearancePref } from './appearancePref';

/**
 * The app's Light / Dark / System choice. One value for the whole app: every screen reads it
 * through useColorSchemeName.
 *
 * Round 178: it no longer sets the phone-level override (Appearance.setColorScheme). After round 173,
 * which set it, John's map and launch animation (both drawn with Skia) stopped showing in Expo Go;
 * that override was the only change in those rounds that reached native views, and in Expo Go it
 * stays on the app's windows across reloads. So the choice stays inside our own colors, and launch
 * clears any override left from before.
 */
let current: AppearancePref = DEFAULT_APPEARANCE;
const listeners = new Set<() => void>();

export function getAppearancePref(): AppearancePref {
  return current;
}

export function applyAppearance(pref: AppearancePref): void {
  if (pref === current) return;
  current = pref;
  listeners.forEach((l) => l());
}

let cleared = false;

/** Takes off a phone-level light/dark override an earlier version set (round 178), once per launch. */
export function clearNativeAppearanceOverride(): void {
  if (cleared) return;
  cleared = true;
  try {
    // 'unspecified' clears the override on iOS and Android alike.
    Appearance.setColorScheme?.('unspecified');
  } catch {
    // Web and tests have no override to clear.
  }
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
