import { AIRPORTS, zonedToUtc } from '@/engine';

import { computeLeaveBy, distanceKm, driveMinutes, leaveByText, LOCATION_FRESH_MS } from '../leaveBy';

const BNA = AIRPORTS.BNA;
const DEP = zonedToUtc('2026-10-20', '09:00', BNA.tz); // 9:00 AM Nashville
const EARLY = zonedToUtc('2026-10-20', '05:00', BNA.tz);
const MIN = 60_000;
// Downtown Nashville, about 13 km from BNA.
const downtown = { lat: 36.1627, lon: -86.7816 };

const run = (over: Partial<Parameters<typeof computeLeaveBy>[0]> = {}) =>
  computeLeaveBy({ airport: BNA, departUtc: DEP, bufferMin: 75, now: EARLY, location: null, ...over });

describe('distance and drive time', () => {
  it('measures great-circle km', () => {
    expect(distanceKm(downtown.lat, downtown.lon, BNA.lat, BNA.lon)).toBeCloseTo(10.2, 0);
  });
  it('uses the prototype estimate, rounded to 5 min', () => {
    expect(driveMinutes(0)).toBe(10);
    expect(driveMinutes(10)).toBe(25); // 10*1.3/55*60 = 14.2 + 10 = 24.2
    expect(driveMinutes(100)).toBe(150);
  });
});

describe('computeLeaveBy', () => {
  it('without location: be at the airport buffer before departure', () => {
    const r = run();
    expect(r).toEqual({ kind: 'beAt', airport: 'BNA', beAtUtc: DEP - 75 * MIN, bufferMin: 75 });
    expect(leaveByText(r, BNA.tz)).toEqual({
      title: 'Be at BNA by 7:45 AM',
      sub: '75 min before departure to list and clear security',
    });
  });

  it('uses the buffer setting', () => {
    expect(run({ bufferMin: 120 })).toMatchObject({ beAtUtc: DEP - 120 * MIN });
  });

  it('with a fresh location: leave by = be-at minus the drive', () => {
    const r = run({ location: { ...downtown, at: EARLY - 5 * MIN } });
    expect(r).toMatchObject({ kind: 'leaveBy', driveMin: 25, leaveUtc: DEP - 100 * MIN });
    expect(leaveByText(r, BNA.tz)).toEqual({
      title: 'Leave by 7:20 AM',
      sub: '~25 min drive from where you are · at BNA by 7:45 AM',
    });
  });

  it('ignores a stale location', () => {
    expect(run({ location: { ...downtown, at: EARLY - LOCATION_FRESH_MS - 1 } }).kind).toBe('beAt');
  });

  it('ignores locations beyond 400 km', () => {
    const atlanta = { lat: AIRPORTS.ATL.lat, lon: AIRPORTS.ATL.lon, at: EARLY };
    expect(distanceKm(atlanta.lat, atlanta.lon, BNA.lat, BNA.lon)).toBeLessThan(400);
    const seattle = { lat: AIRPORTS.SEA.lat, lon: AIRPORTS.SEA.lon, at: EARLY };
    expect(run({ location: seattle }).kind).toBe('beAt');
  });

  it('says you are at the airport within 3 km', () => {
    const r = run({ location: { lat: BNA.lat + 0.01, lon: BNA.lon, at: EARLY } });
    expect(leaveByText(r, BNA.tz)).toEqual({ title: 'You’re at BNA', sub: 'Departs 9:00 AM' });
  });

  it('says leave now when it is already too late', () => {
    const late = DEP - 90 * MIN; // 7:30, drive 25 -> should have left 7:20
    expect(run({ now: late, location: { ...downtown, at: late } })).toMatchObject({ kind: 'leaveNow' });
    expect(leaveByText(run({ now: DEP - 30 * MIN }), BNA.tz)).toEqual({
      title: 'Leave now',
      sub: 'Be at BNA by 7:45 AM',
    });
  });
});
