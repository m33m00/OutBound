import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/** After a page swap VoiceOver drops what's said in the same frame. */
export const ANNOUNCE_AFTER_SWAP_MS = 400;

/** announce(text) speaks a moment later; nothing is said once the screen has gone. */
export function useAnnounceLater(delayMs = ANNOUNCE_AFTER_SWAP_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => AccessibilityInfo.announceForAccessibility(text), delayMs);
    },
    [delayMs],
  );
}
