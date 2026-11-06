import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { EMPTY_MODERATION, flag as flagState, isHidden, MODERATION_KEY, parseModeration, type FlagReason, type ModerationState } from './moderation';

interface ModerationValue {
  hidden: (key: string, senderId?: string) => boolean;
  flag: (key: string, reason: FlagReason, senderId?: string) => void;
}

const ModerationContext = createContext<ModerationValue | null>(null);

/** What you've flagged and whose reports you've hidden, kept on this phone. */
export function ModerationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModerationState>(EMPTY_MODERATION);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(MODERATION_KEY)
      .then((raw) => alive && setState(parseModeration(raw)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const flag = useCallback((key: string, reason: FlagReason, senderId?: string) => {
    setState((s) => {
      const next = flagState(s, key, reason, Date.now(), senderId);
      AsyncStorage.setItem(MODERATION_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const value = useMemo<ModerationValue>(() => ({ hidden: (k, id) => isHidden(state, k, id), flag }), [state, flag]);
  return <ModerationContext.Provider value={value}>{children}</ModerationContext.Provider>;
}

const NO_MODERATION: ModerationValue = { hidden: () => false, flag: () => {} };

/** Works outside the provider too (screens in tests), where nothing is ever hidden. */
export function useModeration(): ModerationValue {
  return useContext(ModerationContext) ?? NO_MODERATION;
}

/** The Flag choices, as an iOS action sheet style alert. */
export function askFlag(onPick: (reason: FlagReason) => void): void {
  Alert.alert('Flag this report?', 'It’s hidden for you right away, and we review flags within 24 hours.', [
    { text: 'Numbers Look Wrong', onPress: () => onPick('wrong') },
    { text: 'Abusive or Spam', onPress: () => onPick('abusive') },
    { text: 'Hide This Person’s Reports', style: 'destructive', onPress: () => onPick('block') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
