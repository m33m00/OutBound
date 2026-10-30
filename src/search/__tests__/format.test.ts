import { createMemoryProvider, searchItineraries, zonedToUtc, type Flight, type LegSeats } from '@/engine';

import {
  dayShift,
  formatAge,
  formatDuration,
  formatTime,
  nearbyNotes,
  neutralSeatText,
  routeSeatAge,
  routeSeatSummary,
  rowAccessibilityLabel,
  rowTimes,
  seatSourceText,
  seatText,
  slimStops,
  stopCount,
  stopsText,
  seatCounts,
} from '../format';

const DATE = '2026-10-20';
const NOW = Date.UTC(2026, 9, 19, 12);
const tzOf: Record<string, string> = {
  BNA: 'America/Chicago',
  ORD: 'America/Chicago',
  DFW: 'America/Chicago',
  DAL: 'America/Chicago',
  LAX: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles',
};
const flight = (id: string, from: string, to: string, time: string, min: number, date = DATE): Flight => {
  const departUtc = zonedToUtc(date, time, tzOf[from]);
  return { id, airline: 'AA', flightNumber: id, from, to, departUtc, arriveUtc: departUtc + min * 60_000 };
};
const seats = (s: Partial<LegSeats>): LegSeats => ({ source: 'reported', tier: 'good', netSeats: 22, asOf: NOW, ...s });

async function itinerary(flights: Flight[], origin: string, destination: string, reports = {}, originArea = false) {
  const [it] = await searchItineraries(
    createMemoryProvider(flights, reports),
    { origin, destination, date: DATE, originArea },
    { now: NOW },
  );
  return it;
}

describe('time and duration', () => {
  it('formats local clock time per airport', () => {
    const t = zonedToUtc(DATE, '07:05', 'America/Chicago');
    expect(formatTime(t, 'America/Chicago')).toBe('7:05 AM');
    expect(formatTime(t, 'America/Los_Angeles')).toBe('5:05 AM');
  });

  it('counts local day shifts', () => {
    const dep = zonedToUtc(DATE, '22:00', 'America/Los_Angeles');
    expect(dayShift(dep, 'America/Los_Angeles', dep + 5 * 3600_000, 'America/New_York')).toBe(1);
    expect(dayShift(dep, 'America/Los_Angeles', dep + 3600_000, 'America/Los_Angeles')).toBe(0);
  });

  it.each([
    [45, '45m'],
    [60, '1h'],
    [135, '2h 15m'],
  ])('%i min -> %s', (min, text) => expect(formatDuration(min)).toBe(text));

  it.each([
    [0, 'just now'],
    [12, '12m ago'],
    [180, '3h ago'],
    [60 * 72, '3d ago'],
  ])('age %i min -> %s', (min, text) => expect(formatAge(NOW - min * 60_000, NOW)).toBe(text));
});

describe('seatText', () => {
  it('always pairs the tier word with the number and age', () => {
    expect(seatText(seats({ asOf: NOW - 12 * 60_000 }), NOW)).toBe('Good · 22 open · reported 12m ago');
    expect(seatText(seats({ source: 'estimate', tier: 'wide', netSeats: 60 }), NOW)).toBe('Wide open · 60 open · est. just now');
  });
  it('says Full with no open seats', () => {
    expect(seatText(seats({ tier: 'full', netSeats: -3 }), NOW)).toBe('Full · no open seats · reported just now');
  });
  it('keeps typical loads neutral (no tier word)', () => {
    expect(seatText(seats({ source: 'typical', tier: 'unknown', netSeats: 30 }), NOW)).toBe('Typically ~30 open · Oct data');
  });
  it('handles no data', () => {
    expect(seatText({ source: 'unknown', tier: 'unknown', netSeats: null, asOf: null }, NOW)).toBe('No data yet');
  });
});

describe('seat summary (Q-059)', () => {
  const NOW = Date.UTC(2026, 9, 19, 12);
  const seats = (p: Partial<LegSeats>): LegSeats => ({ source: 'reported', tier: 'good', netSeats: 8, asOf: NOW, ...p });
  const route = (legs: LegSeats[], tier: LegSeats['tier']) =>
    ({ tier, legs: legs.map((s) => ({ seats: s })) }) as unknown as Parameters<typeof routeSeatSummary>[0];

  it('names the weakest counted leg', () => {
    expect(routeSeatSummary(route([seats({ tier: 'good', netSeats: 9 }), seats({ tier: 'tight', netSeats: 2 })], 'tight'))).toBe('Tight · 2 open');
    expect(routeSeatSummary(route([seats({ tier: 'full', netSeats: -3 })], 'full'))).toBe('Full · no open seats');
  });

  it('stays off when no leg has reported or estimated seats', () => {
    expect(routeSeatSummary(route([seats({ source: 'typical', tier: 'unknown', netSeats: 12 })], 'unknown'))).toBeNull();
  });

  it('says where a number came from and its age', () => {
    expect(seatSourceText(seats({}), NOW)).toBe('Reported just now');
    expect(seatSourceText(seats({ source: 'estimate', asOf: NOW - 2 * 3_600_000 }), NOW)).toBe('Est. 2h ago');
    expect(seatSourceText(seats({ source: 'typical' }), NOW)).toBeNull();
  });
});

describe('slim row seat and stop text (design round 22)', () => {
  const NOW = Date.UTC(2026, 9, 19, 12);
  const seats = (p: Partial<LegSeats>): LegSeats => ({ source: 'reported', tier: 'good', netSeats: 8, asOf: NOW, ...p });
  const route = (legs: LegSeats[], tier: LegSeats['tier'], connections: { airport: string; layoverMin: number }[] = []) =>
    ({ tier, stops: connections.length, connections, legs: legs.map((s) => ({ seats: s })) }) as unknown as Parameters<
      typeof routeSeatSummary
    >[0];

  it('gives the summary the age of the leg that sets it', () => {
    const r = route([seats({ tier: 'good', netSeats: 20 }), seats({ tier: 'tight', netSeats: 2, source: 'estimate', asOf: NOW - 3_600_000 })], 'tight');
    expect(routeSeatAge(r, NOW)).toBe('Est. 1h ago');
    expect(routeSeatAge(route([seats({ source: 'typical', tier: 'unknown' })], 'unknown'), NOW)).toBeNull();
  });

  it('keeps typical-only routes neutral but says what is known', () => {
    const r = route(
      [seats({ source: 'typical', tier: 'unknown', netSeats: 40, asOf: Date.UTC(2026, 6, 1) }), seats({ source: 'typical', tier: 'unknown', netSeats: 12, asOf: Date.UTC(2026, 6, 1) })],
      'unknown',
    );
    expect(neutralSeatText(r, NOW)).toBe('Typically ~12 open · Jul data');
    expect(neutralSeatText(route([seats({ source: 'unknown', tier: 'unknown', netSeats: null, asOf: null })], 'unknown'), NOW)).toBe('No data yet');
  });

  it('adds short connections to the stop count', () => {
    expect(slimStops(route([seats({})], 'good'))).toBe('Nonstop');
    expect(slimStops(route([seats({}), seats({})], 'good', [{ airport: 'DEN', layoverMin: 45 }]))).toBe('1 stop · 45m at DEN');
    expect(slimStops(route([seats({}), seats({})], 'good', [{ airport: 'DEN', layoverMin: 90 }]))).toBe('1 stop');
  });
});

describe('row text', () => {
  it('describes a connection with +1 day and stops', async () => {
    const it = await itinerary(
      [flight('1', 'SEA', 'ORD', '21:00', 240), flight('2', 'ORD', 'BNA', '05:00', 100, '2026-10-21')],
      'SEA',
      'BNA',
    );
    expect(stopsText(it)).toBe('1 stop · ORD');
    expect(stopCount(it)).toBe('1 stop');
    expect(rowTimes(it)).toEqual({ depart: '9:00 PM', arrive: '6:40 AM', plusDays: '+1' });
  });

  it('notes area airports', async () => {
    const it = await itinerary([flight('1', 'DAL', 'LAX', '09:00', 200)], 'DFW', 'LAX', {}, true);
    expect(nearbyNotes(it)).toEqual(['Leaves from DAL, 35 min from DFW']);
  });

  it('says "near" when an area pair has no transfer time yet', async () => {
    const it = await itinerary([flight('1', 'DAL', 'LAX', '09:00', 200)], 'DFW', 'LAX', {}, true);
    expect(nearbyNotes({ ...it, originTransferMin: null })).toEqual(['Leaves from DAL, near DFW']);
  });

  it('builds a full VoiceOver label', async () => {
    const it = await itinerary([flight('1', 'BNA', 'LAX', '09:00', 260)], 'BNA', 'LAX', {
      '1': [{ source: 'reported', openSeats: 30, listed: 8, asOf: NOW - 5 * 60_000 }],
    });
    expect(rowAccessibilityLabel(it, NOW)).toBe(
      'Departs 9:00 AM from BNA, arrives 11:20 AM at LAX, Nonstop, 4h 20m, Route Good, AA 1: Good, 30 open, 8 listed, reported 5m ago',
    );
  });
});

describe('seatCounts (Q-065)', () => {
  const base: LegSeats = { source: 'reported', tier: 'tight', netSeats: 3, asOf: 0 };
  it('shows open and listed when the reading has both', () => {
    expect(seatCounts({ ...base, openSeats: 20, listed: 17 })).toBe('20 open · 17 listed');
  });
  it('falls back to the net count for older data', () => {
    expect(seatCounts(base)).toBe('3 open');
    expect(seatCounts({ ...base, netSeats: -2, tier: 'full' })).toBe('no open seats');
  });
});
