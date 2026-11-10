/**
 * Membership tiers (round 176, John): Free, Pay as you go and Premium. A demo for now: nothing is
 * charged and credits live on this phone.
 *
 * - Free: every route and time, but seats stay hidden until you request a route's loads. A request
 *   costs a credit; answering loads earns them.
 * - Pay as you go: the same, starting with more credits (buying more comes later).
 * - Premium: every load always shows, no credits to track.
 */
import type { Itinerary, LegSeats } from '@/engine';

export type Tier = 'free' | 'payg' | 'premium';
export const TIERS = ['free', 'payg', 'premium'] as const satisfies readonly Tier[];

export const TIER_LABEL: Record<Tier, string> = {
  free: 'Free',
  payg: 'Pay as you go',
  premium: 'Premium',
};

/** One line on what each plan gets, for the picker. */
export const TIER_PITCH: Record<Tier, string> = {
  free: 'Every route and time. Seats stay hidden until you request them, with credits you earn by answering loads.',
  payg: 'Seats stay hidden until you request them. Spend credits as you go and add more when you need them.',
  premium: 'Every load, always showing. No credits to keep track of.',
};

export const parseTier = (v: unknown): Tier | null =>
  typeof v === 'string' && (TIERS as readonly string[]).includes(v) ? (v as Tier) : null;

/** Free and Pay as you go count credits; Premium doesn't. */
export const tracksCredits = (tier: Tier | null): tier is 'free' | 'payg' => tier === 'free' || tier === 'payg';

/** Seats hide until requested on Free and Pay as you go. Before a plan is picked nothing hides. */
export const seatsLocked = (tier: Tier | null) => tracksCredits(tier);

/** What requesting one route's loads costs. */
export const REQUEST_COST = 1;
/** What answering one flight's load earns. */
export const EARN_PER_ANSWER = 1;
/** Credits a plan starts with, once per plan (demo). */
export const WELCOME_CREDITS: Record<Tier, number> = { free: 3, payg: 10, premium: 0 };

export type CreditKind = 'welcome' | 'answered' | 'requested';

export interface CreditEntry {
  /** One entry per thing: a welcome per plan, an answer per flight, a request per route. */
  id: string;
  at: number;
  delta: number;
  kind: CreditKind;
  label: string;
}

export interface Wallet {
  /** Newest first. */
  entries: CreditEntry[];
  /** Flights whose loads you requested (flight keys); their seats show on every plan. */
  unlocked: string[];
  /** Plans that already got their starting credits. */
  welcomed: Tier[];
}

export const WALLET_KEY = 'outbound.wallet.v1';
export const EMPTY_WALLET: Wallet = { entries: [], unlocked: [], welcomed: [] };
/** History kept on the phone. */
const MAX_ENTRIES = 100;

export const balance = (w: Wallet) => w.entries.reduce((sum, e) => sum + e.delta, 0);
export const earnedTotal = (w: Wallet) => w.entries.filter((e) => e.kind === 'answered').reduce((s, e) => s + e.delta, 0);
export const spentTotal = (w: Wallet) => -w.entries.filter((e) => e.delta < 0).reduce((s, e) => s + e.delta, 0);

const add = (w: Wallet, e: CreditEntry): Wallet =>
  w.entries.some((x) => x.id === e.id) ? w : { ...w, entries: [e, ...w.entries].slice(0, MAX_ENTRIES) };

/** A plan's starting credits, the first time it's picked. */
export function welcome(w: Wallet, tier: Tier, now: number): Wallet {
  if (!tracksCredits(tier) || w.welcomed.includes(tier)) return w;
  const next = add(w, {
    id: `welcome-${tier}`,
    at: now,
    delta: WELCOME_CREDITS[tier],
    kind: 'welcome',
    label: `${TIER_LABEL[tier]} starting credits`,
  });
  return { ...next, welcomed: [...w.welcomed, tier] };
}

/** A credit for answering a flight's load, once per flight. */
export const earn = (w: Wallet, key: string, label: string, now: number): Wallet =>
  add(w, { id: `answered-${key}`, at: now, delta: EARN_PER_ANSWER, kind: 'answered', label });

export const legKeys = (it: Itinerary, key: (f: Itinerary['legs'][number]['flight']) => string) =>
  it.legs.map((l) => key(l.flight));

export const isUnlocked = (w: Wallet, keys: readonly string[]) => keys.length > 0 && keys.every((k) => w.unlocked.includes(k));

export type RequestOutcome = 'requested' | 'already' | 'short';

/** Spends a route's credit and unlocks its flights; 'short' when there aren't enough credits. */
export function requestRoute(
  w: Wallet,
  keys: readonly string[],
  label: string,
  now: number,
): { wallet: Wallet; outcome: RequestOutcome } {
  if (isUnlocked(w, keys)) return { wallet: w, outcome: 'already' };
  if (balance(w) < REQUEST_COST) return { wallet: w, outcome: 'short' };
  const spent = add(w, { id: `requested-${keys.join('+')}-${now}`, at: now, delta: -REQUEST_COST, kind: 'requested', label });
  return { wallet: { ...spent, unlocked: [...new Set([...w.unlocked, ...keys])] }, outcome: 'requested' };
}

const HIDDEN: LegSeats = { source: 'unknown', tier: 'unknown', netSeats: null, asOf: null };

/** The route with its seats taken off, as Free and Pay as you go show it before a request. */
export const hideSeats = (it: Itinerary): Itinerary => ({ ...it, legs: it.legs.map((l) => ({ ...l, seats: HIDDEN })) });

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Sample loads for a requested flight in this demo: the seats search knows when it has them,
 * otherwise made-up numbers that stay the same for that flight.
 */
export function demoLoad(seats: LegSeats, key: string): { open: number; listed: number } {
  if (seats.openSeats != null && seats.listed != null) return { open: seats.openSeats, listed: seats.listed };
  const h = hash(key);
  return { open: h % 40, listed: (h >>> 8) % 12 };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const KINDS: readonly CreditKind[] = ['welcome', 'answered', 'requested'];

export function parseWallet(raw: unknown): Wallet {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const entries = (Array.isArray(o.entries) ? o.entries : [])
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .filter(
      (e) =>
        typeof e.id === 'string' &&
        isNum(e.at) &&
        isNum(e.delta) &&
        Number.isInteger(e.delta) &&
        Math.abs(e.delta) <= 100 &&
        KINDS.includes(e.kind as CreditKind) &&
        typeof e.label === 'string' &&
        e.label.length <= 80,
    )
    .slice(0, MAX_ENTRIES) as unknown as CreditEntry[];
  const unlocked = (Array.isArray(o.unlocked) ? o.unlocked : []).filter(
    (k): k is string => typeof k === 'string' && k.length <= 120,
  );
  const welcomed = (Array.isArray(o.welcomed) ? o.welcomed : []).map(parseTier).filter((t): t is Tier => t != null);
  return { entries, unlocked: [...new Set(unlocked)].slice(0, 500), welcomed: [...new Set(welcomed)] };
}

/** "+1", "−1". */
export const deltaText = (d: number) => (d > 0 ? `+${d}` : `−${Math.abs(d)}`);
export const creditsWord = (n: number) => `${n} ${n === 1 ? 'credit' : 'credits'}`;
