import { useSyncExternalStore } from 'react';

/**
 * Whether this launch's intro has lifted off, so a sheet (the plan picker, round 176) waits for it
 * instead of opening over the animation.
 */
let done = false;
const listeners = new Set<() => void>();

export function markIntroDone(): void {
  if (done) return;
  done = true;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useIntroDone = () => useSyncExternalStore(subscribe, () => done);
