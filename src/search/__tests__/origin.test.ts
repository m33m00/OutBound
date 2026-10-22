import { AIRPORTS } from '@/engine';

import { nearestAirport } from '../airports';
import { chooseOrigin, showLocationCard } from '../origin';

describe('nearestAirport (Q-051)', () => {
  it('picks the closest airport', () => {
    // Downtown Nashville.
    expect(nearestAirport(36.1627, -86.7816)).toBe('BNA');
    // Sitting on the DFW reference point.
    expect(nearestAirport(AIRPORTS.DFW.lat, AIRPORTS.DFW.lon)).toBe('DFW');
    // Uptown Dallas is closer to Love Field.
    expect(nearestAirport(32.8, -96.8)).toBe('DAL');
  });

  it('answers however far away the phone is', () => {
    // Honolulu: nothing nearby in the sample data, still an airport.
    expect(nearestAirport(21.3, -157.85)).toBe('LAX');
    // London.
    expect(nearestAirport(51.5, -0.12)).toBe('LGA');
  });

  it('is null only with no airports', () => {
    expect(nearestAirport(0, 0, [])).toBeNull();
  });
});

describe('chooseOrigin (Q-051)', () => {
  const all = { picked: undefined, nearest: 'DEN', mainHome: 'DFW', lastOrigin: 'ORD' };

  it('a hand pick wins over everything', () => {
    expect(chooseOrigin({ ...all, picked: 'SEA' })).toBe('SEA');
    // Swap with an empty To is a real pick too.
    expect(chooseOrigin({ ...all, picked: null })).toBeNull();
  });

  it('then the nearest airport, then main home, then last origin, then empty', () => {
    expect(chooseOrigin(all)).toBe('DEN');
    expect(chooseOrigin({ ...all, nearest: null })).toBe('DFW');
    expect(chooseOrigin({ ...all, nearest: null, mainHome: null })).toBe('ORD');
    expect(chooseOrigin({ picked: undefined, nearest: null, mainHome: null, lastOrigin: null })).toBeNull();
  });
});

describe('showLocationCard (Q-051)', () => {
  const fresh = { settingsLoaded: true, locationAsked: false, useLocation: false, permission: 'undetermined' as const };

  it('shows on first launch once settings and permission are known', () => {
    expect(showLocationCard(fresh)).toBe(true);
    expect(showLocationCard({ ...fresh, settingsLoaded: false })).toBe(false);
    expect(showLocationCard({ ...fresh, permission: 'unknown' })).toBe(false);
  });

  it('never shows after Not Now', () => {
    expect(showLocationCard({ ...fresh, locationAsked: true })).toBe(false);
  });

  it('never shows once permission was denied or granted', () => {
    expect(showLocationCard({ ...fresh, permission: 'denied' })).toBe(false);
    expect(showLocationCard({ ...fresh, permission: 'granted' })).toBe(false);
  });

  it('never shows once location is on (Allow, Profile toggle or leave-by)', () => {
    expect(showLocationCard({ ...fresh, useLocation: true })).toBe(false);
  });
});
