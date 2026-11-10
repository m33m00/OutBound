/**
 * Account rules the screens check before they ask the server (App Store round 2, 2026-11-06).
 * The server enforces the airline email list on its own (supabase/migrations/..._accounts.sql);
 * these only make the answer quick and kind.
 */

/** Passwords: at least this long. Matches the Supabase setting John turns on (auth minimum 8). */
export const MIN_PASSWORD = 8;
/** Codes Supabase emails are this many digits (auth.email.otp_length). */
export const CODE_LENGTH = 6;
/** Wait this long before offering to send the code again. */
export const RESEND_AFTER_S = 60;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Looks like an address: something@something.something, no spaces. */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}

export function domainOf(raw: string): string {
  const e = normalizeEmail(raw);
  const at = e.lastIndexOf('@');
  return at < 0 ? '' : e.slice(at + 1);
}

/**
 * Personal mail services. An address here is never an airline's, so the app can say so before
 * asking the server. Not a list of who's allowed: that lives on the server.
 */
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'att.net',
  'sbcglobal.net',
  'comcast.net',
]);

export function isPersonalEmail(raw: string): boolean {
  return PERSONAL_DOMAINS.has(domainOf(raw));
}

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function checkPassword(pw: string): PasswordCheck {
  if (pw.length < MIN_PASSWORD) return { ok: false, reason: `Use at least ${MIN_PASSWORD} characters.` };
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { ok: false, reason: 'Use at least one letter and one number.' };
  return { ok: true };
}

/** Only digits, at most CODE_LENGTH of them (pasting "123 456" works). */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** What went wrong, in words for the person, from a Supabase auth error. */
export function friendlyAuthError(err: unknown): string {
  const msg = (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? ''))
    .toLowerCase();
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (msg.includes('outbound_email_not_allowed') || (msg.includes('database error') && msg.includes('user')))
    return NOT_AIRLINE_EMAIL;
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'That email and password don’t match.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'Confirm your email first. We sent you a code.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'There’s already an account with that email. Log in instead.';
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid') && msg.includes('token'))
    return 'That code didn’t work or has expired. Send a new one.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Pick a stronger password.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || msg.includes('rate limit'))
    return 'Too many tries. Wait a minute and try again.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Can’t reach OutBound right now. Check your connection.';
  return 'Something went wrong. Try again.';
}

export const NOT_AIRLINE_EMAIL = 'Use your airline work email. OutBound is only for airline employees.';
