import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { addSaved, parseSavedRoutes, removeSaved, SAVED_ROUTES_KEY, type SavedRoute } from './savedRoutes';

interface SavedRoutesContextValue {
  routes: SavedRoute[];
  /** False until saved routes have been read. */
  loaded: boolean;
  isSaved: (key: string) => boolean;
  save: (route: SavedRoute) => void;
  remove: (key: string) => void;
  /** A route My Trips asked Search to open; Search clears it once it starts the search. */
  opening: SavedRoute | null;
  open: (route: SavedRoute) => void;
  clearOpening: () => void;
}

const SavedRoutesContext = createContext<SavedRoutesContextValue | null>(null);

/** Loads saved routes from the phone once and saves every change (Q-043). */
export function SavedRoutesProvider({ children }: { children: ReactNode }) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [opening, setOpening] = useState<SavedRoute | null>(null);
  // Changes made before the read finishes are kept on top of what was on the phone.
  const early = useRef<((list: SavedRoute[]) => SavedRoute[])[]>([]);
  const isLoaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SAVED_ROUTES_KEY)
      .then((raw) => (raw ? parseSavedRoutes(JSON.parse(raw)) : []))
      .catch(() => [] as SavedRoute[])
      .then((stored) => {
        if (!alive) return;
        isLoaded.current = true;
        const changes = early.current;
        early.current = [];
        const next = changes.reduce((list, change) => change(list), stored);
        setRoutes(next);
        if (changes.length) AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(next)).catch(() => {});
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const change = useCallback((fn: (list: SavedRoute[]) => SavedRoute[]) => {
    if (!isLoaded.current) early.current.push(fn);
    setRoutes((list) => {
      const next = fn(list);
      if (isLoaded.current) AsyncStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SavedRoutesContextValue>(
    () => ({
      routes,
      loaded,
      isSaved: (key) => routes.some((r) => r.key === key),
      save: (route) => change((list) => addSaved(list, route)),
      remove: (key) => change((list) => removeSaved(list, key)),
      opening,
      open: setOpening,
      clearOpening: () => setOpening(null),
    }),
    [routes, loaded, opening, change],
  );

  return <SavedRoutesContext.Provider value={value}>{children}</SavedRoutesContext.Provider>;
}

export function useSavedRoutes(): SavedRoutesContextValue {
  const ctx = useContext(SavedRoutesContext);
  if (!ctx) throw new Error('useSavedRoutes must be used inside SavedRoutesProvider');
  return ctx;
}
