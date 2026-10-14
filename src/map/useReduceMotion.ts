/**
 * iOS/Android "Reduce Motion" setting, live. Uses React Native's
 * AccessibilityInfo (works in Expo Go) so a change while the app is open
 * takes effect without a restart.
 *
 * `known` turns true once the first query answered (or failed), so the
 * launch spin-in never starts before we know it is allowed.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotionStatus(): { reduce: boolean; known: boolean } {
  const [state, setState] = useState({ reduce: false, known: false });
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setState({ reduce: v, known: true });
      })
      .catch(() => {
        if (alive) setState((s) => ({ reduce: s.reduce, known: true }));
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setState({ reduce: v, known: true }),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return state;
}

export function useReduceMotion(): boolean {
  return useReduceMotionStatus().reduce;
}
