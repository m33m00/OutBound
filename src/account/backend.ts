import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeEmail } from './rules';

export type CodePurpose = 'signup' | 'reset';

export interface AccountUser {
  id: string;
  email: string;
}

/**
 * Everything the account screens need from the server, in one small shape so the screens can be
 * tested without Supabase. Each call throws a Supabase-style error ({ message, code }) on failure.
 */
export interface AccountBackend {
  current(): Promise<AccountUser | null>;
  /** Calls back on sign in, sign out and token refresh; returns the unsubscribe. */
  onChange(cb: (user: AccountUser | null) => void): () => void;
  /** True or false from the server's airline list; null when it can't say (offline, not set up). */
  emailAllowed(email: string): Promise<boolean | null>;
  /** needsCode: the account waits for the emailed code (email confirmation on). */
  signUp(email: string, password: string): Promise<{ needsCode: boolean }>;
  verifyCode(email: string, code: string, purpose: CodePurpose): Promise<void>;
  resendCode(email: string, purpose: CodePurpose): Promise<void>;
  logIn(email: string, password: string): Promise<void>;
  sendReset(email: string): Promise<void>;
  setPassword(password: string): Promise<void>;
  logOut(): Promise<void>;
  /** Deletes the account on the server for good, then signs out on this phone. */
  deleteAccount(): Promise<void>;
}

const toUser = (u: { id: string; email?: string | null } | null | undefined): AccountUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

export function supabaseBackend(sb: SupabaseClient): AccountBackend {
  return {
    async current() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async emailAllowed(email) {
      const { data, error } = await sb.rpc('email_is_allowed', { p_email: normalizeEmail(email) });
      if (error || typeof data !== 'boolean') return null;
      return data;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email: normalizeEmail(email), password });
      if (error) throw error;
      return { needsCode: !data.session };
    },
    async verifyCode(email, code, purpose) {
      const { error } = await sb.auth.verifyOtp({
        email: normalizeEmail(email),
        token: code,
        type: purpose === 'signup' ? 'signup' : 'recovery',
      });
      if (error) throw error;
    },
    async resendCode(email, purpose) {
      const e = normalizeEmail(email);
      const { error } = purpose === 'signup' ? await sb.auth.resend({ type: 'signup', email: e }) : await sb.auth.resetPasswordForEmail(e);
      if (error) throw error;
    },
    async logIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) throw error;
    },
    async sendReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(normalizeEmail(email));
      if (error) throw error;
    },
    async setPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
    },
    async logOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    },
    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account');
      if (error) throw error;
      // The account is gone on the server; drop this phone's copy of the session too.
      await sb.auth.signOut({ scope: 'local' });
    },
  };
}
