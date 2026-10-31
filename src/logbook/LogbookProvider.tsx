import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { addLogged, LOGBOOK_KEY, parseLogbook, removeLogged, replaceLogged, type LoggedFlight } from './logbook';

interface LogbookContextValue {
  flights: LoggedFlight[];
  /** False until the logbook has been read. */
  loaded: boolean;
  add: (flights: readonly LoggedFlight[]) => void;
  remove: (id: string) => void;
  /** Swap a logged flight for its fixed version. */
  replace: (id: string, flight: LoggedFlight) => void;
}

const LogbookContext = createContext<LogbookContextValue | null>(null);

/** Loads the logbook from the phone once and saves every change. Nothing leaves the phone. */
export function LogbookProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<LoggedFlight[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Changes made before the read finishes are kept on top of what was on the phone.
  const early = useRef<((list: LoggedFlight[]) => LoggedFlight[])[]>([]);
  const isLoaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LOGBOOK_KEY)
      .then((raw) => (raw ? parseLogbook(JSON.parse(raw)) : []))
      .catch(() => [] as LoggedFlight[])
      .then((stored) => {
        if (!alive) return;
        isLoaded.current = true;
        const changes = early.current;
        early.current = [];
        const next = changes.reduce((list, change) => change(list), stored);
        setFlights(next);
        if (changes.length) AsyncStorage.setItem(LOGBOOK_KEY, JSON.stringify(next)).catch(() => {});
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const change = useCallback((fn: (list: LoggedFlight[]) => LoggedFlight[]) => {
    if (!isLoaded.current) early.current.push(fn);
    setFlights((list) => {
      const next = fn(list);
      if (isLoaded.current) AsyncStorage.setItem(LOGBOOK_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<LogbookContextValue>(
    () => ({
      flights,
      loaded,
      add: (added) => change((list) => addLogged(list, added)),
      remove: (id) => change((list) => removeLogged(list, id)),
      replace: (id, flight) => change((list) => replaceLogged(list, id, flight)),
    }),
    [flights, loaded, change],
  );

  return <LogbookContext.Provider value={value}>{children}</LogbookContext.Provider>;
}

/** The logbook, or null outside LogbookProvider (screens that can show it but don't need it). */
export function useLogbookIfThere(): LogbookContextValue | null {
  return useContext(LogbookContext);
}

export function useLogbook(): LogbookContextValue {
  const ctx = useContext(LogbookContext);
  if (!ctx) throw new Error('useLogbook must be used inside LogbookProvider');
  return ctx;
}
