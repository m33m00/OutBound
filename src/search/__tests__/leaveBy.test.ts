import { AIRPORTS, zonedToUtc } from '@/engine';

import {
  boardingLeadMin,
  computeLeaveBy,
  distanceKm,
  driveMinutes,
  driveQuery,
  leaveByShort,
  leaveByText,
  isWidebody,
  LOCATION_FRESH_MS,
} from '../leaveBy';

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
      // John's words (round 159).
      title: 'Arrive at BNA by 7:45 AM to begin boarding',
      sub: '1h 15m early to list and clear security',
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
      sub: '25m drive. Arrive at BNA by 7:45 AM to begin boarding',
    });
  });

  it('uses a maps drive time with traffic when one came back (John, 2026-11-01)', () => {
    const r = run({ location: { ...downtown, at: EARLY - 5 * MIN }, liveDriveMin: 32 });
    expect(r).toMatchObject({ kind: 'leaveBy', driveMin: 32, live: true, leaveUtc: DEP - 107 * MIN });
    expect(leaveByText(r, BNA.tz)).toEqual({
      title: 'Leave by 7:13 AM',
      sub: '32m drive with traffic. Arrive at BNA by 7:45 AM to begin boarding',
    });
    expect(leaveByShort(r, BNA.tz)).toBe('32m drive');
    // No live answer: the rough guess, marked with ~.
    expect(run({ location: { ...downtown, at: EARLY - 5 * MIN }, liveDriveMin: null })).toMatchObject({
      driveMin: 25,
      live: false,
    });
  });

  it('asks maps about the trip only when a drive estimate would show, leaving around the rough leave time', () => {
    const base = { airport: BNA, departUtc: DEP, bufferMin: 75, now: EARLY };
    expect(driveQuery({ ...base, location: null })).toBeNull();
    expect(driveQuery({ ...base, location: { ...downtown, at: EARLY - LOCATION_FRESH_MS - 1 } })).toBeNull();
    expect(driveQuery({ ...base, location: { lat: BNA.lat, lon: BNA.lon, at: EARLY } })).toBeNull();
    expect(driveQuery({ ...base, location: { ...downtown, at: EARLY }, departed: true })).toBeNull();
    const q = driveQuery({ ...base, location: { ...downtown, at: EARLY } });
    expect(q).toEqual({ from: downtown, to: { lat: BNA.lat, lon: BNA.lon }, departMs: DEP - 100 * MIN });
    // Already past the rough leave time: traffic for now.
    expect(driveQuery({ ...base, now: DEP - 90 * MIN, location: { ...downtown, at: DEP - 90 * MIN } })?.departMs).toBe(
      DEP - 90 * MIN,
    );
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
    // The airport's name too (John, 2026-11-02), and boarding in his words (round 159).
    expect(leaveByText(r, BNA.tz)).toEqual({
      title: `You’re at BNA (${AIRPORTS.BNA.name})`,
      // Boarding 40 minutes before a domestic departure (round 162, John).
      sub: 'Your flight begins boarding at 8:20 AM',
    });
    expect(leaveByShort(r, BNA.tz)).toBe('Your flight begins boarding at 8:20 AM');
    // International or widebody: 50 minutes.
    const long = run({ location: { lat: BNA.lat + 0.01, lon: BNA.lon, at: EARLY }, boardingMin: 50 });
    expect(leaveByShort(long, BNA.tz)).toBe('Your flight begins boarding at 8:10 AM');
  });

  it('says leave now when it is already too late', () => {
    const late = DEP - 90 * MIN; // 7:30, drive 25 -> should have left 7:20
    expect(run({ now: late, location: { ...downtown, at: late } })).toMatchObject({ kind: 'leaveNow' });
    expect(leaveByText(run({ now: DEP - 30 * MIN }), BNA.tz)).toEqual({
      title: 'Leave now',
      sub: 'Arrive at BNA by 7:45 AM to begin boarding',
    });
    // Beside Leave now on the slim row, spelled out (John, 2026-11-03), ending "to begin boarding" (round 159).
    expect(leaveByShort(run({ now: DEP - 30 * MIN }), BNA.tz)).toBe('Arrive at BNA by 7:45 AM to begin boarding');
    // The arrive-by title already says everything, so no detail beside it (round 159).
    expect(leaveByShort(run(), BNA.tz)).toBe('');
  });

  it('says departed only when live status says so, never from the schedule (round 42, Q-050)', () => {
    const after = DEP + 10 * MIN;
    // Past the scheduled time but no live word: it may be delayed, so still "Leave now".
    expect(run({ now: after }).kind).toBe('leaveNow');
    const r = run({ now: after, location: { lat: BNA.lat, lon: BNA.lon, at: after }, departed: true });
    expect(r).toEqual({ kind: 'departed', airport: 'BNA' });
    expect(leaveByText(r, BNA.tz)).toEqual({ title: 'Departed', sub: 'This flight has left BNA. Pick a later route.' });
    expect(leaveByShort(r, BNA.tz)).toBe('Pick a later route');
  });
});

describe('boarding lead (round 162, John)', () => {
  it('is 40 minutes domestic, 50 international or widebody', () => {
    expect(boardingLeadMin('DFW', 'LAX', 'Boeing 737-800')).toBe(40);
    expect(boardingLeadMin('DFW', 'LAX')).toBe(40);
    expect(boardingLeadMin('DFW', 'LAX', 'Boeing 777-200')).toBe(50);
    expect(boardingLeadMin('DFW', 'LAX', 'Airbus A350-900')).toBe(50);
    const table = { DFW: { country: 'US' }, LHR: { country: 'GB' } };
    expect(boardingLeadMin('DFW', 'LHR', 'Boeing 737-800', table)).toBe(50);
  });
  it('knows the twin-aisle types and leaves the 757 and A321 alone', () => {
    for (const t of ['Boeing 747-8', '767-300ER', 'B787-9', 'Airbus A330-300', 'A380-800', 'MD-11'])
      expect(isWidebody(t)).toBe(true);
    for (const t of ['Boeing 757-200', 'Airbus A321neo', 'Boeing 737 MAX 8', 'Embraer E175', null])
      expect(isWidebody(t)).toBe(false);
  });
});
