import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Light "tick" for picking something (design round 10): date chips, area
 * toggle, swap, stops, steppers, radar and route selection. iOS skips it on
 * its own when System Haptics is off. Never throws; a missed tick is fine.
 */
export function selectionTick(): void {
  if (Platform.OS === 'web') return;
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    // No haptics engine (simulator, tests).
  }
}

/** Wraps a handler so it ticks first. */
export const withTick =
  <A extends unknown[]>(fn: (...args: A) => void) =>
  (...args: A) => {
    selectionTick();
    fn(...args);
  };
