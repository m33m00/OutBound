import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type Settings } from './settings';

interface SettingsContextValue {
  settings: Settings;
  /** False until saved settings have been read (defaults until then). */
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Loads settings from the phone once and saves every change. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (alive && raw) setSettings(parseSettings(JSON.parse(raw)));
      })
      .catch(() => {
        // Unreadable saved settings: keep defaults.
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: Settings) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loaded,
      update: (patch) => save(parseSettings({ ...settings, ...patch })),
      reset: () => save(DEFAULT_SETTINGS),
    }),
    [settings, loaded, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
