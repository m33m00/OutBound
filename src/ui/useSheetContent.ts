import { useEffect, useRef, useState } from 'react';

/** Long enough for a page sheet to finish sliding away (design round 29). */
export const SHEET_CLOSE_MS = 500;

/**
 * What a page sheet shows while it opens, stays and slides away (design
 * round 29). `open` is the thing the sheet is for, or null when it should
 * close. The sheet hides at once, but keeps showing the last thing until it
 * has slid away, so it never goes blank or changes title on the way out.
 */
export function useSheetContent<T>(open: T | null): { shown: T | null; visible: boolean } {
  const [kept, setKept] = useState<T | null>(open);
  const last = useRef<T | null>(open);
  if (open !== null) last.current = open;

  useEffect(() => {
    if (open !== null) return setKept(open);
    const t = setTimeout(() => {
      last.current = null;
      setKept(null);
    }, SHEET_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  return { shown: open ?? kept ?? last.current, visible: open !== null };
}
