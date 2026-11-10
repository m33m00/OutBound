import type { Itinerary } from '@/engine';

import {
  balance,
  demoLoad,
  earn,
  earnedTotal,
  EMPTY_WALLET,
  hideSeats,
  isUnlocked,
  parseTier,
  parseWallet,
  requestRoute,
  seatsLocked,
  spentTotal,
  tracksCredits,
  welcome,
  WELCOME_CREDITS,
} from '../membership';

const NOW = Date.UTC(2026, 10, 7, 18);

describe('membership tiers (round 176)', () => {
  it('Free and Pay as you go count credits and hide seats; Premium does neither', () => {
    expect(tracksCredits('free')).toBe(true);
    expect(tracksCredits('payg')).toBe(true);
    expect(tracksCredits('premium')).toBe(false);
    expect(seatsLocked('premium')).toBe(false);
    expect(seatsLocked('free')).toBe(true);
    // Before a plan is picked nothing hides.
    expect(seatsLocked(null)).toBe(false);
    expect(parseTier('payg')).toBe('payg');
    expect(parseTier('gold')).toBeNull();
  });

  it('gives each plan its starting credits once', () => {
    let w = welcome(EMPTY_WALLET, 'free', NOW);
    expect(balance(w)).toBe(WELCOME_CREDITS.free);
    w = welcome(w, 'free', NOW + 1);
    expect(balance(w)).toBe(WELCOME_CREDITS.free);
    w = welcome(w, 'payg', NOW + 2);
    expect(balance(w)).toBe(WELCOME_CREDITS.free + WELCOME_CREDITS.payg);
    expect(welcome(w, 'premium', NOW)).toBe(w);
  });

  it('earns a credit per answered flight, once each', () => {
    let w = earn(EMPTY_WALLET, 'WN1', 'Answered WN 1', NOW);
    w = earn(w, 'WN1', 'Answered WN 1', NOW + 1);
    w = earn(w, 'WN2', 'Answered WN 2', NOW + 2);
    expect(balance(w)).toBe(2);
    expect(earnedTotal(w)).toBe(2);
    expect(w.entries[0].label).toBe('Answered WN 2');
  });

  it('spends a credit to unlock a route, once, and refuses when short', () => {
    const short = requestRoute(EMPTY_WALLET, ['A', 'B'], 'Requested', NOW);
    expect(short.outcome).toBe('short');
    let w = welcome(EMPTY_WALLET, 'free', NOW);
    const first = requestRoute(w, ['A', 'B'], 'Requested DAL to LAX', NOW);
    expect(first.outcome).toBe('requested');
    w = first.wallet;
    expect(balance(w)).toBe(WELCOME_CREDITS.free - 1);
    expect(spentTotal(w)).toBe(1);
    expect(isUnlocked(w, ['A', 'B'])).toBe(true);
    expect(isUnlocked(w, ['A', 'C'])).toBe(false);
    expect(requestRoute(w, ['B', 'A'], 'Again', NOW).outcome).toBe('already');
  });

  it('hides every leg’s seats and makes steady sample loads', () => {
    const it = {
      id: 'x',
      origin: 'DAL',
      legs: [
        { flight: { id: 'f' }, seats: { source: 'reported', tier: 'wide', netSeats: 20, openSeats: 22, listed: 2, asOf: NOW } },
      ],
    } as unknown as Itinerary;
    const hidden = hideSeats(it);
    expect(hidden.legs[0].seats).toEqual({ source: 'unknown', tier: 'unknown', netSeats: null, asOf: null });
    expect(it.legs[0].seats.netSeats).toBe(20);
    expect(demoLoad(it.legs[0].seats, 'k')).toEqual({ open: 22, listed: 2 });
    const made = demoLoad(hidden.legs[0].seats, 'WN1-DAL');
    expect(made).toEqual(demoLoad(hidden.legs[0].seats, 'WN1-DAL'));
    expect(made.open).toBeGreaterThanOrEqual(0);
  });

  it('reads back a saved wallet and drops anything odd', () => {
    const w = requestRoute(welcome(EMPTY_WALLET, 'payg', NOW), ['A'], 'Requested', NOW).wallet;
    expect(parseWallet(JSON.parse(JSON.stringify(w)))).toEqual(w);
    expect(
      parseWallet({ entries: [{ id: 'x', at: NOW, delta: 9999, kind: 'welcome', label: 'x' }], welcomed: ['gold'] }),
    ).toEqual(EMPTY_WALLET);
    expect(parseWallet(null)).toEqual(EMPTY_WALLET);
  });
});
