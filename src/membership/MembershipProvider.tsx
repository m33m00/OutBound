import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Itinerary } from '@/engine';
import { flightKey } from '@/requests/requests';
import { useSettings } from '@/settings/SettingsProvider';

import {
  balance,
  earn as earnIn,
  EMPTY_WALLET,
  isUnlocked,
  legKeys,
  parseWallet,
  requestLegs as requestIn,
  seatsLocked,
  tracksCredits,
  WALLET_KEY,
  welcome,
  type RequestOutcome,
  type Tier,
  type Wallet,
} from './membership';

interface MembershipContextValue {
  /** Null until picked. */
  tier: Tier | null;
  setTier: (tier: Tier) => void;
  wallet: Wallet;
  /** Read from the phone. */
  loaded: boolean;
  credits: number;
  /** Free and Pay as you go. */
  tracksCredits: boolean;
  /** Seats hidden on some leg of this route until its loads are requested. */
  isLocked: (it: Itinerary) => boolean;
  /** Which legs of the route still hide their seats (round 189: requested per leg). */
  lockedLegs: (it: Itinerary) => number[];
  /** A credit for answering a flight's load (once per flight, Free and Pay as you go only). */
  earnForAnswer: (key: string, label: string) => void;
  /** Spends a credit per leg on the picked legs' loads (round 189). */
  requestLegs: (it: Itinerary, legs: readonly number[], label: string) => RequestOutcome;
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

/**
 * The plan (kept with the settings) and the credits wallet (kept on the phone), round 176.
 * A demo: nothing is charged.
 */
export function MembershipProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const tier = settings.membership;
  const [wallet, setWallet] = useState<Wallet>(EMPTY_WALLET);
  const [loaded, setLoaded] = useState(false);
  const early = useRef<((w: Wallet) => Wallet)[]>([]);
  const isLoaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(WALLET_KEY)
      .then((raw) => (raw ? parseWallet(JSON.parse(raw)) : EMPTY_WALLET))
      .catch(() => EMPTY_WALLET)
      .then((stored) => {
        if (!alive) return;
        isLoaded.current = true;
        const changes = early.current;
        early.current = [];
        const next = changes.reduce((w, fn) => fn(w), stored);
        setWallet(next);
        if (changes.length) AsyncStorage.setItem(WALLET_KEY, JSON.stringify(next)).catch(() => {});
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const change = useCallback((fn: (w: Wallet) => Wallet) => {
    if (!isLoaded.current) early.current.push(fn);
    setWallet((w) => {
      const next = fn(w);
      if (next === w) return w;
      if (isLoaded.current) AsyncStorage.setItem(WALLET_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // A plan's starting credits land the first time it's picked.
  useEffect(() => {
    if (tier && tracksCredits(tier)) change((w) => welcome(w, tier, Date.now()));
  }, [tier, change]);

  const setTier = useCallback((t: Tier) => update({ membership: t }), [update]);
  const earnForAnswer = useCallback(
    (key: string, label: string) => {
      if (tracksCredits(tier)) change((w) => earnIn(w, key, label, Date.now()));
    },
    [tier, change],
  );
  const requestLegs = useCallback(
    (it: Itinerary, legs: readonly number[], label: string): RequestOutcome => {
      const all = legKeys(it, flightKey);
      const keys = legs.map((i) => all[i]).filter((k): k is string => k != null);
      const now = Date.now();
      const { outcome } = requestIn(wallet, keys, label, now);
      if (outcome === 'requested') change((w) => requestIn(w, keys, label, now).wallet);
      return outcome;
    },
    [wallet, change],
  );

  const value = useMemo<MembershipContextValue>(
    () => ({
      tier,
      setTier,
      wallet,
      loaded,
      credits: balance(wallet),
      tracksCredits: tracksCredits(tier),
      isLocked: (it) => seatsLocked(tier) && !isUnlocked(wallet, legKeys(it, flightKey)),
      lockedLegs: (it) =>
        seatsLocked(tier) ? legKeys(it, flightKey).flatMap((k, i) => (wallet.unlocked.includes(k) ? [] : [i])) : [],
      earnForAnswer,
      requestLegs,
    }),
    [tier, setTier, wallet, loaded, earnForAnswer, requestLegs],
  );
  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

/** Null outside the provider (some screens' tests render without it). */
export const useMembershipOptional = () => useContext(MembershipContext);

export function useMembership(): MembershipContextValue {
  const v = useContext(MembershipContext);
  if (!v) throw new Error('useMembership needs MembershipProvider');
  return v;
}
