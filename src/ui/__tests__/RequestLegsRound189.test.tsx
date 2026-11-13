import type { Itinerary } from '@/engine';
import { balance, EMPTY_WALLET, hideSeats, lockedKeys, requestCost, requestLegs, welcome } from '@/membership/membership';

const NOW = Date.UTC(2026, 10, 11, 18);
describe('request loads per leg (round 189, John: "1 credit per leg. Not route.")', () => {
  it('charges a credit for each leg not already requested', () => {
    let w = welcome(EMPTY_WALLET, 'free', NOW); // 3 credits
    expect(requestCost(w, ['A', 'B'])).toBe(2);
    w = requestLegs(w, ['A'], 'Requested DAL to DEN', NOW).wallet;
    expect(balance(w)).toBe(2);
    expect(lockedKeys(w, ['A', 'B'])).toEqual(['B']);
    expect(requestCost(w, ['A', 'B'])).toBe(1);
    // Requesting the whole route now only charges the leg still hidden.
    const all = requestLegs(w, ['A', 'B'], 'Requested DAL to DEN to LAX', NOW + 1);
    expect(all.outcome).toBe('requested');
    expect(balance(all.wallet)).toBe(1);
    expect(all.wallet.entries[0].delta).toBe(-1);
    expect(requestLegs(all.wallet, ['A', 'B'], 'Again', NOW + 2).outcome).toBe('already');
  });

  it('refuses when there are not enough credits for every picked leg', () => {
    const w = requestLegs(welcome(EMPTY_WALLET, 'free', NOW), ['A', 'B'], 'x', NOW).wallet; // 1 left
    expect(requestLegs(w, ['C', 'D'], 'y', NOW).outcome).toBe('short');
    expect(requestLegs(w, ['C'], 'y', NOW).outcome).toBe('requested');
  });

  it('hides only the legs that were not requested', () => {
    const seats = { source: 'reported', tier: 'wide', netSeats: 20, openSeats: 22, listed: 2, asOf: NOW };
    const it = {
      id: 'x',
      origin: 'DAL',
      legs: [
        { flight: {}, seats },
        { flight: {}, seats },
      ],
    } as unknown as Itinerary;
    const view = hideSeats(it, (i) => i === 0);
    expect(view.legs[0].seats.netSeats).toBe(20);
    expect(view.legs[1].seats.netSeats).toBeNull();
  });
});
