import { airlineAllowed, isUsAirline, leavesInTimes, localMinuteOfDay, timeOfDayOf } from '../filters';
import { createMemoryProvider } from '../memoryProvider';
import { searchItineraries, searchRoutes } from '../search';
import type { Flight, SearchOptions, SeatReport } from '../types';
import { zonedToUtc } from '../time';

import { DATE, NOW, flight, seats } from '../testHelpers';

function search(
  flights: Flight[],
  origin: string,
  destination: string,
  options: Partial<SearchOptions> = {},
  reports: Record<string, SeatReport[]> = {},
  area: { originArea?: boolean; destinationArea?: boolean } = {},
) {
  return searchItineraries(
    createMemoryProvider(flights, reports),
    { origin, destination, date: DATE, ...area },
    { now: NOW, ...options },
  );
}
const ids = (list: { id: string }[]) => list.map((i) => i.id).sort();

describe('time of day (round 174)', () => {
  it('reads the local clock at the airport', () => {
    expect(localMinuteOfDay(zonedToUtc(DATE, '06:30', 'America/Chicago'), 'America/Chicago')).toBe(390);
    expect(localMinuteOfDay(zonedToUtc(DATE, '23:15', 'America/Los_Angeles'), 'America/Los_Angeles')).toBe(1395);
  });

  it.each([
    [300, 'morning'],
    [719, 'morning'],
    [720, 'afternoon'],
    [1019, 'afternoon'],
    [1020, 'evening'],
    [1259, 'evening'],
    [1260, 'night'],
    [0, 'night'],
    [299, 'night'],
  ])('minute %i is %s', (m, t) => {
    expect(timeOfDayOf(m)).toBe(t);
  });

  it('none picked means any time', () => {
    expect(leavesInTimes(zonedToUtc(DATE, '03:00', 'America/Chicago'), 'America/Chicago', [])).toBe(true);
  });

  it('keeps only routes whose first flight leaves in a picked part of the day', async () => {
    const flights = [
      flight('M', 'AA', 'BNA', 'LAX', '07:00', 260),
      flight('A', 'AA', 'BNA', 'LAX', '13:00', 260),
      flight('E', 'AA', 'BNA', 'LAX', '18:00', 260),
      flight('N', 'AA', 'BNA', 'LAX', '22:30', 260),
    ];
    expect(ids(await search(flights, 'BNA', 'LAX', { departTimes: ['morning'] }))).toEqual(['M']);
    expect(ids(await search(flights, 'BNA', 'LAX', { departTimes: ['afternoon', 'night'] }))).toEqual(['A', 'N']);
    expect(ids(await search(flights, 'BNA', 'LAX', { departTimes: [] }))).toEqual(['A', 'E', 'M', 'N']);
  });

  it('judges a connection by its first flight only', async () => {
    const flights = [flight('IN', 'UA', 'BNA', 'ORD', '11:00', 120), flight('OUT', 'UA', 'ORD', 'LAX', '14:00', 270)];
    expect(ids(await search(flights, 'BNA', 'LAX', { departTimes: ['morning'] }))).toEqual(['IN+OUT']);
    expect(await search(flights, 'BNA', 'LAX', { departTimes: ['afternoon'] })).toHaveLength(0);
  });
});

describe('airports to avoid (round 174)', () => {
  const flights = [
    flight('A1', 'UA', 'BNA', 'ORD', '08:00', 120),
    flight('A2', 'UA', 'ORD', 'LAX', '11:00', 270),
    flight('B1', 'AA', 'BNA', 'DFW', '08:00', 120),
    flight('B2', 'AA', 'DFW', 'LAX', '11:00', 200),
    flight('C', 'WN', 'BNA', 'LAX', '09:00', 260),
  ];

  it('drops routes that connect there', async () => {
    expect(ids(await search(flights, 'BNA', 'LAX', { avoidAirports: ['ORD'] }))).toEqual(['B1+B2', 'C']);
    expect(ids(await search(flights, 'BNA', 'LAX', { avoidAirports: ['ORD', 'DFW'] }))).toEqual(['C']);
  });

  it('never drops the airports typed in From and To', async () => {
    expect(ids(await search(flights, 'BNA', 'LAX', { avoidAirports: ['BNA', 'LAX'] }))).toEqual(['A1+A2', 'B1+B2', 'C']);
  });

  it('skips an avoided area airport at either end', async () => {
    const dallas = [flight('D1', 'WN', 'DAL', 'LAX', '09:00', 200), flight('D2', 'AA', 'DFW', 'LAX', '09:00', 200)];
    expect(ids(await search(dallas, 'DAL', 'LAX', {}, {}, { originArea: true }))).toEqual(['D1', 'D2']);
    expect(ids(await search(dallas, 'DAL', 'LAX', { avoidAirports: ['DFW'] }, {}, { originArea: true }))).toEqual(['D1']);
  });
});

describe('airlines and US airlines only (round 174)', () => {
  it('knows US airlines and regionals, and treats anything else as not US', () => {
    expect(isUsAirline('WN')).toBe(true);
    expect(isUsAirline('OO')).toBe(true);
    expect(isUsAirline('AC')).toBe(false);
    expect(isUsAirline('ZZ')).toBe(false);
    expect(airlineAllowed('AC', [], 'all')).toBe(true);
    expect(airlineAllowed('AC', ['AC'], 'us')).toBe(false);
    expect(airlineAllowed('DL', ['UA'], 'all')).toBe(false);
  });

  const flights = [
    flight('W', 'WN', 'BNA', 'LAX', '09:00', 260),
    flight('X1', 'UA', 'BNA', 'ORD', '08:00', 120),
    flight('X2', 'AC', 'ORD', 'LAX', '12:00', 270),
    flight('Y2', 'UA', 'ORD', 'LAX', '11:30', 270),
  ];

  it('picked airlines must fly every flight', async () => {
    expect(ids(await search(flights, 'BNA', 'LAX', { airlines: ['UA'] }))).toEqual(['X1+Y2']);
    expect(ids(await search(flights, 'BNA', 'LAX', { airlines: ['UA', 'AC'] }))).toEqual(['X1+X2', 'X1+Y2']);
    expect(ids(await search(flights, 'BNA', 'LAX', { airlines: [] }))).toEqual(['W', 'X1+X2', 'X1+Y2']);
  });

  it('US airlines only drops a route with any foreign flight', async () => {
    expect(ids(await search(flights, 'BNA', 'LAX', { airlineRegion: 'us' }))).toEqual(['W', 'X1+Y2']);
  });
});

describe('only answered loads (round 174)', () => {
  const flights = [
    flight('R', 'WN', 'BNA', 'LAX', '09:00', 260),
    flight('E', 'AA', 'BNA', 'LAX', '10:00', 260),
    flight('N', 'UA', 'BNA', 'LAX', '11:00', 260),
    flight('C1', 'UA', 'BNA', 'ORD', '08:00', 120),
    flight('C2', 'UA', 'ORD', 'LAX', '11:00', 270),
  ];
  const reports = { R: seats('reported', 20), E: seats('estimate', 20), C1: seats('reported', 5), C2: seats('typical', 40) };

  it('keeps only routes where every flight has a reported load', async () => {
    expect(ids(await search(flights, 'BNA', 'LAX', { answeredOnly: true }, reports))).toEqual(['R']);
    expect(ids(await search(flights, 'BNA', 'LAX', { answeredOnly: false }, reports))).toHaveLength(4);
  });

  it('counts routes the new filters hid, so the empty list can offer them', async () => {
    const out = await searchRoutes(
      createMemoryProvider(flights, reports),
      { origin: 'BNA', destination: 'LAX', date: DATE },
      { now: NOW, answeredOnly: true, airlines: ['DL'] },
      { answeredOnly: false, airlines: [] },
    );
    expect(out.results).toHaveLength(0);
    expect(out.hiddenCount).toBe(4);
  });
});
