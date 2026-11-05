import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The route card shows once that it slides sideways (round 136, John: "Hard for a user to know they
 * can swipe left or right to see the next flight"). Kept on the phone so it plays only the first time.
 */
export const FLIP_HINT_KEY = 'outbound.routeFlipHint.v1';

let seen: boolean | null = null;

/** Whether the nudge still has to play; marks it played as it answers yes. */
export async function takeFlipHint(): Promise<boolean> {
  if (seen) return false;
  try {
    seen = (await AsyncStorage.getItem(FLIP_HINT_KEY)) === '1';
  } catch {
    seen = false;
  }
  if (seen) return false;
  seen = true;
  AsyncStorage.setItem(FLIP_HINT_KEY, '1').catch(() => {});
  return true;
}

/** Tests only. */
export function resetFlipHintForTests(): void {
  seen = null;
}

/** The nudge: the card slides this far left, then springs back. */
export const FLIP_NUDGE = { distance: 28, out: 260, delay: 650 } as const;
