import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabaseBackend, type AccountBackend, type AccountUser, type CodePurpose } from './backend';
import { PREVIEW_ALLOWED, supabase } from './client';
import { friendlyAuthError, NOT_AIRLINE_EMAIL } from './rules';

/** Remembers "look around first" in a preview build, so each launch doesn't ask again. */
export const PREVIEW_KEY = 'outbound.preview.v1';

/** Everything OutBound keeps on the phone; Delete Account clears it all. */
export const LOCAL_DATA_KEYS = [
  'outbound.settings.v1',
  'outbound.savedRoutes.v1',
  'outbound.logbook.v1',
  'outbound.routeFlipHint.v1',
  'outbound.moderation.v1',
  PREVIEW_KEY,
] as const;

export type AccountStatus = 'loading' | 'signedOut' | 'signedIn' | 'preview';

/** Result of an account action: ok, or a sentence to show under the form. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export interface AccountContextValue {
  status: AccountStatus;
  user: AccountUser | null;
  /** Signed in through a reset code and still has to pick a new password. */
  settingPassword: boolean;
  /** False when the app has no server to talk to (local sample mode); only preview works then. */
  serverReady: boolean;
  /** Preview builds only: look around without an account. */
  canPreview: boolean;
  /** Changes when the account is deleted, so data held in memory starts over. */
  epoch: number;
  signUp(email: string, password: string): Promise<ActionResult & { needsCode?: boolean }>;
  verifyCode(email: string, code: string, purpose: CodePurpose): Promise<ActionResult>;
  resendCode(email: string, purpose: CodePurpose): Promise<ActionResult>;
  logIn(email: string, password: string): Promise<ActionResult & { needsCode?: boolean }>;
  sendReset(email: string): Promise<ActionResult>;
  setPassword(password: string): Promise<ActionResult>;
  logOut(): Promise<void>;
  deleteAccount(): Promise<ActionResult>;
  startPreview(): void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const fail = (err: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyAuthError(err) });

/**
 * Who's signed in (App Store round 2). Accounts are Supabase Auth, limited on the server to
 * airline work emails. `backend` is for tests; the app uses Supabase.
 */
export function AccountProvider({ children, backend: given }: { children: ReactNode; backend?: AccountBackend | null }) {
  const backend = useMemo(() => {
    if (given !== undefined) return given;
    const sb = supabase();
    return sb ? supabaseBackend(sb) : null;
  }, [given]);

  const [user, setUser] = useState<AccountUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    let alive = true;
    const off = backend?.onChange((u) => alive && setUser(u));
    Promise.all([
      backend ? backend.current().catch(() => null) : Promise.resolve(null),
      PREVIEW_ALLOWED ? AsyncStorage.getItem(PREVIEW_KEY).catch(() => null) : Promise.resolve(null),
    ]).then(([u, p]) => {
      if (!alive) return;
      setUser(u);
      setPreview(p === '1');
      setLoaded(true);
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [backend]);

  const startPreview = useCallback(() => {
    if (!PREVIEW_ALLOWED) return;
    setPreview(true);
    AsyncStorage.setItem(PREVIEW_KEY, '1').catch(() => {});
  }, []);

  const value = useMemo<AccountContextValue>(() => {
    const noServer = { ok: false as const, error: 'Accounts aren’t set up in this build yet.' };
    return {
      status: !loaded ? 'loading' : user ? 'signedIn' : preview && PREVIEW_ALLOWED ? 'preview' : 'signedOut',
      user,
      settingPassword,
      serverReady: backend != null,
      canPreview: PREVIEW_ALLOWED,
      epoch,
      async signUp(email, password) {
        if (!backend) return noServer;
        try {
          if ((await backend.emailAllowed(email)) === false) return { ok: false, error: NOT_AIRLINE_EMAIL };
          const { needsCode } = await backend.signUp(email, password);
          return { ok: true, needsCode };
        } catch (e) {
          return fail(e);
        }
      },
      async verifyCode(email, code, purpose) {
        if (!backend) return noServer;
        try {
          // Set before the session lands, so a reset never flashes into the app first.
          if (purpose === 'reset') setSettingPassword(true);
          await backend.verifyCode(email, code, purpose);
          return { ok: true };
        } catch (e) {
          if (purpose === 'reset') setSettingPassword(false);
          return fail(e);
        }
      },
      async resendCode(email, purpose) {
        if (!backend) return noServer;
        try {
          await backend.resendCode(email, purpose);
          return { ok: true };
        } catch (e) {
          return fail(e);
        }
      },
      async logIn(email, password) {
        if (!backend) return noServer;
        try {
          await backend.logIn(email, password);
          return { ok: true };
        } catch (e) {
          const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
          if (code === 'email_not_confirmed') {
            await backend.resendCode(email, 'signup').catch(() => {});
            return { ok: false, error: friendlyAuthError(e), needsCode: true };
          }
          return fail(e);
        }
      },
      async sendReset(email) {
        if (!backend) return noServer;
        try {
          await backend.sendReset(email);
          return { ok: true };
        } catch (e) {
          return fail(e);
        }
      },
      async setPassword(password) {
        if (!backend) return noServer;
        try {
          await backend.setPassword(password);
          setSettingPassword(false);
          return { ok: true };
        } catch (e) {
          return fail(e);
        }
      },
      async logOut() {
        setSettingPassword(false);
        setPreview(false);
        AsyncStorage.removeItem(PREVIEW_KEY).catch(() => {});
        if (backend && user) await backend.logOut().catch(() => {});
        setUser(null);
      },
      async deleteAccount() {
        if (!backend || !user) return noServer;
        try {
          await backend.deleteAccount();
        } catch (e) {
          return fail(e);
        }
        await AsyncStorage.multiRemove([...LOCAL_DATA_KEYS]).catch(() => {});
        setPreview(false);
        setUser(null);
        setEpoch((n) => n + 1);
        return { ok: true };
      },
      startPreview,
    };
  }, [backend, loaded, user, preview, settingPassword, epoch, startPreview]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const v = useContext(AccountContext);
  if (!v) throw new Error('useAccount must be used inside AccountProvider');
  return v;
}

/** The app's tabs show only when signed in (and not mid password reset), or in a preview. */
export function canUseApp(a: Pick<AccountContextValue, 'status' | 'settingPassword'>): boolean {
  return (a.status === 'signedIn' && !a.settingPassword) || a.status === 'preview';
}
