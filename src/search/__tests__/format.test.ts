import { createMemoryProvider, searchItineraries, zonedToUtc, type Flight, type LegSeats } from '@/engine';

import {
  dayShift,
  formatAge,
  formatDuration,
  formatTime,
  nearbyNotes,
  rowAccessibilityLabel,
  rowTimes,
  seatText,
  stopCount,
  stopsText,
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
      'Departs 9:00 AM from BNA, arrives 11:20 AM at LAX, Nonstop, 4h 20m, Route Good, AA 1: Good, 22 open, reported 5m ago',
    );
  });
});
