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

/** A soft thump for a primary button (round 113): heavier than a pick, lighter than a success. */
export function impactTick(): void {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // No haptics engine (simulator, tests).
  }
}

/** The double tap iOS uses for "done": a saved route, a sent report, an ask (round 113). */
export function successTap(): void {
  if (Platform.OS === 'web') return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // No haptics engine (simulator, tests).
  }
}
