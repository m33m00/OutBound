import { createMemoryProvider } from '../memoryProvider';
import { createSampleProvider } from '../sample/sampleProvider';
import { searchItineraries, searchRoutes } from '../search';
import { toRouteLine } from '../toRouteLine';
import type { Flight, SearchOptions, SeatReport } from '../types';

import { DATE, NOW, flight, seats } from '../testHelpers';

function search(
  flights: Flight[],
  origin: string,
  destination: string,
  options: Partial<SearchOptions> = {},
  reports: Record<string, SeatReport[]> = {},
  date = DATE,
  area: { originArea?: boolean; destinationArea?: boolean } = {},
) {
  return searchItineraries(
    createMemoryProvider(flights, reports),
    { origin, destination, date, ...area },
    { now: NOW, ...options },
  );
}

const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe('searchItineraries: stops and connections', () => {
  it('finds a nonstop', async () => {
    const [it] = await search([flight('A', 'AA', 'BNA', 'LAX', '09:00', 260)], 'BNA', 'LAX');
    expect(it).toMatchObject({ id: 'A', pathKey: 'BNA>LAX', stops: 0, connections: [], totalMin: 260 });
  });

  // BNA->ORD lands 10:00 local Chicago; ORD departures at the given local time.
  const viaOrd = (airline: string, time: string) => [
    flight('IN', 'UA', 'BNA', 'ORD', '08:00', 120),
    flight('OUT', airline, 'ORD', 'LAX', time, 270),
  ];

  it.each([
    ['same airline, 60 min', 'UA', '11:00', true],
    ['same airline, 59 min', 'UA', '10:59', false],
    ['switching, 90 min', 'AA', '11:30', true],
    ['switching, 89 min', 'AA', '11:29', false],
    ['max layover 240 min', 'UA', '14:00', true],
    ['layover 241 min', 'UA', '14:01', false],
  ])('connection rule: %s', async (_name, airline, time, ok) => {
    const result = await search(viaOrd(airline, time), 'BNA', 'LAX');
    expect(result.length).toBe(ok ? 1 : 0);
  });

  it('reports connection details', async () => {
    const [it] = await search(viaOrd('AA', '12:00'), 'BNA', 'LAX');
    expect(it.connections).toEqual([{ airport: 'ORD', layoverMin: 120, sameAirline: false }]);
    expect(it.pathKey).toBe('BNA>ORD>LAX');
  });

  it('honors connection settings', async () => {
    const result = await search(viaOrd('UA', '10:45'), 'BNA', 'LAX', { minConnectSameAirlineMin: 45 });
    expect(result).toHaveLength(1);
  });

  // A chain BNA->ATL->CLT->ORD->DEN->LAX, 1h legs with 1h connections.
  const chain = [
    flight('1', 'AA', 'BNA', 'ATL', '06:00', 60),
    flight('2', 'AA', 'ATL', 'CLT', '09:00', 60),
    flight('3', 'AA', 'CLT', 'ORD', '11:00', 60),
    flight('4', 'AA', 'ORD', 'DEN', '12:00', 60),
    flight('5', 'AA', 'DEN', 'LAX', '13:00', 60),
  ];

  it('allows up to 3 stops and no more', async () => {
    expect(ids(await search(chain, 'BNA', 'DEN'))).toEqual(['1+2+3+4']);
    expect(await search(chain, 'BNA', 'LAX')).toEqual([]);
  });

  it('respects maxStops', async () => {
    expect(await search(chain, 'BNA', 'CLT', { maxStops: 0 })).toEqual([]);
    expect(ids(await search(chain, 'BNA', 'CLT', { maxStops: 1 }))).toEqual(['1+2']);
  });

  it('never revisits an airport', async () => {
    const loop = [
      flight('a', 'AA', 'BNA', 'ORD', '06:00', 90),
      flight('b', 'AA', 'ORD', 'BNA', '09:00', 90),
      flight('c', 'AA', 'BNA', 'LAX', '12:00', 260),
    ];
    expect(ids(await search(loop, 'BNA', 'LAX'))).toEqual(['c']);
  });

  it('stops at the destination instead of flying through it', async () => {
    const through = [
      flight('a', 'AA', 'BNA', 'DFW', '06:00', 120),
      flight('b', 'AA', 'DFW', 'LAX', '10:00', 200),
    ];
    expect(ids(await search(through, 'BNA', 'DFW'))).toEqual(['a']);
  });

  it('caps total trip time (provisional 24h)', async () => {
    expect(await search(viaOrd('UA', '12:00'), 'BNA', 'LAX', { maxTripMin: 300 })).toEqual([]);
  });
});

describe('searchItineraries: dates', () => {
  it('uses the local date at the origin', async () => {
    // 23:30 Pacific on the 20th is the 21st in UTC.
    const late = [flight('late', 'AA', 'LAX', 'SEA', '23:30', 160)];
    expect(ids(await search(late, 'LAX', 'SEA'))).toEqual(['late']);
    expect(await search(late, 'LAX', 'SEA', {}, {}, '2026-10-21')).toEqual([]);
  });

  it('allows later legs on the next day (overnight connection)', async () => {
    const overnight = [
      flight('a', 'AA', 'SEA', 'LAX', '21:00', 165),
      flight('b', 'AA', 'LAX', 'PHX', '01:00', 80, '2026-10-21'),
    ];
    expect(ids(await search(overnight, 'SEA', 'PHX'))).toEqual(['a+b']);
  });

  it('keeps flights that already left, mixed in by time (Q-047)', async () => {
    const f = [flight('ok', 'AA', 'BNA', 'LAX', '18:00', 260), flight('gone', 'AA', 'BNA', 'LAX', '06:00', 260)];
    const nowLocal8am = Date.UTC(2026, 9, 20, 13, 0); // 08:00 CDT
    expect(ids(await search(f, 'BNA', 'LAX', { now: nowLocal8am }))).toEqual(['gone', 'ok']);
  });

  it('only searches 0-7 days out', async () => {
    const f = [flight('x', 'AA', 'BNA', 'LAX', '09:00', 260, '2026-10-26')];
    expect(ids(await search(f, 'BNA', 'LAX', {}, {}, '2026-10-26'))).toEqual(['x']); // 7 days
    await expect(search(f, 'BNA', 'LAX', {}, {}, '2026-10-27')).rejects.toThrow(RangeError);
    await expect(search(f, 'BNA', 'LAX', {}, {}, '2026-10-18')).rejects.toThrow(RangeError);
  });

  it('rejects unknown airports', async () => {
    await expect(search([], 'XXX', 'LAX')).rejects.toThrow(RangeError);
  });
});

describe('searchItineraries: airport areas (Dallas: DAL, DFW)', () => {
  const flights = [
    flight('dfw', 'AA', 'DFW', 'LAX', '09:00', 200),
    flight('dal', 'WN', 'DAL', 'LAX', '10:00', 200),
    flight('in', 'WN', 'BNA', 'DAL', '06:00', 120),
  ];
  const wholeFrom = { originArea: true };
  const wholeTo = { destinationArea: true };

  it('searches exactly the requested airports when the toggles are off', async () => {
    expect(ids(await search(flights, 'DFW', 'LAX'))).toEqual(['dfw']);
    expect(await search(flights, 'BNA', 'DFW')).toEqual([]);
  });

  it('includes the area origin when its toggle is on, and flags it', async () => {
    const result = await search(flights, 'DFW', 'LAX', {}, {}, DATE, wholeFrom);
    expect(ids(result)).toEqual(['dfw', 'dal']);
    expect(result[1]).toMatchObject({
      requestedOrigin: 'DFW',
      origin: 'DAL',
      originTransferMin: 35,
      destinationTransferMin: 0,
    });
  });

  it('includes the area destination when its toggle is on', async () => {
    const [it] = await search(flights, 'BNA', 'DFW', {}, {}, DATE, wholeTo);
    expect(it).toMatchObject({ destination: 'DAL', requestedDestination: 'DFW', destinationTransferMin: 35 });
  });

  it('expands each end on its own toggle only', async () => {
    const back = [flight('r1', 'AA', 'LAX', 'DFW', '09:00', 180), flight('r2', 'WN', 'LAX', 'DAL', '10:00', 180)];
    expect(ids(await search(flights, 'DFW', 'LAX', {}, {}, DATE, wholeTo))).toEqual(['dfw']);
    expect(ids(await search(back, 'LAX', 'DFW', {}, {}, DATE, wholeFrom))).toEqual(['r1']);
    expect(ids(await search(back, 'LAX', 'DFW', {}, {}, DATE, wholeTo))).toEqual(['r1', 'r2']);
  });

  it('never connects through an origin/destination area airport', async () => {
    const viaDal = [
      flight('a', 'WN', 'DFW', 'DAL', '06:00', 30),
      flight('b', 'WN', 'DAL', 'LAX', '08:00', 200),
    ];
    expect(ids(await search(viaDal, 'DFW', 'LAX', {}, {}, DATE, wholeFrom))).toEqual(['b']);
  });
});

describe('searchItineraries: sort and limit', () => {
  it('sorts by earliest arrival, then fewer stops, then availability', async () => {
    const flights = [
      flight('late', 'AA', 'BNA', 'LAX', '12:00', 260), // arrives last
      flight('n1', 'AA', 'BNA', 'LAX', '08:00', 260), // nonstop, 10:20 PT
      flight('c1', 'AA', 'BNA', 'ORD', '06:00', 60), // 1 stop, same arrival
      flight('c2', 'AA', 'ORD', 'LAX', '08:00', 260),
      flight('n2', 'UA', 'BNA', 'LAX', '08:00', 260), // nonstop, same arrival, better seats
    ];
    const reports = { n1: seats('reported', 3), n2: seats('estimate', 40) };
    const result = await search(flights, 'BNA', 'LAX', {}, reports);
    expect(ids(result)).toEqual(['n2', 'n1', 'c1+c2', 'late']);
  });

  it('keeps full routes in time order and marks them', async () => {
    const flights = [
      flight('full', 'AA', 'BNA', 'LAX', '07:00', 260),
      flight('open', 'AA', 'BNA', 'LAX', '09:00', 260),
    ];
    const result = await search(flights, 'BNA', 'LAX', {}, { full: seats('reported', 0), open: seats('reported', 60) });
    expect(ids(result)).toEqual(['full', 'open']);
    expect(result.map((r) => [r.tier, r.isFull])).toEqual([
      ['full', true],
      ['wide', false],
    ]);
  });

  it('returns the top 10 by default', async () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      flight(`f${i}`, 'AA', 'BNA', 'LAX', `${String(6 + i).padStart(2, '0')}:00`, 260),
    );
    expect(await search(many, 'BNA', 'LAX')).toHaveLength(10);
    expect(await search(many, 'BNA', 'LAX', { limit: 3 })).toHaveLength(3);
  });

  it('attaches per-leg seats and the weakest-leg route tier', async () => {
    const flights = [flight('a', 'AA', 'BNA', 'ORD', '06:00', 60), flight('b', 'AA', 'ORD', 'LAX', '08:00', 260)];
    const [it] = await search(flights, 'BNA', 'LAX', {}, { a: seats('reported', 60), b: seats('typical', 2) });
    expect(it.legs.map((l) => [l.seats.source, l.seats.tier])).toEqual([
      ['reported', 'wide'],
      ['typical', 'unknown'],
    ]);
    expect(it.tier).toBe('wide');
  });
});

describe('searchRoutes: empty-result reasons (Q-047)', () => {
  const run = (flights: Flight[], options: Partial<SearchOptions>, loose: Partial<SearchOptions> = {}) =>
    searchRoutes(createMemoryProvider(flights, {}), { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW, ...options }, loose);
  const oneStop = [flight('a', 'AA', 'BNA', 'DFW', '08:00', 120), flight('b', 'AA', 'DFW', 'LAX', '11:00', 180)];

  it('returns results and nothing hidden when the filters leave routes', async () => {
    const out = await run([flight('A', 'AA', 'BNA', 'LAX', '09:00', 260), ...oneStop], { maxStops: 0 });
    expect(ids(out.results)).toEqual(['A']);
    expect(out).toMatchObject({ hiddenCount: 0, hiddenResults: [] });
  });

  it('counts routes the filters hid and returns them for Show Them', async () => {
    const twoRoutes = [...oneStop, flight('c', 'AA', 'DFW', 'LAX', '12:00', 180)];
    const out = await run(twoRoutes, { maxStops: 0 }, { maxStops: 3 });
    expect(out.results).toEqual([]);
    expect(out.hiddenCount).toBe(2);
    expect(ids(out.hiddenResults)).toEqual(['a+b', 'a+c']);
  });

  it('uses the loose values for the second pass (shorter connections)', async () => {
    const tight = [flight('a', 'AA', 'BNA', 'DFW', '08:00', 120), flight('b', 'AA', 'DFW', 'LAX', '10:40', 180)];
    expect((await run(tight, {})).hiddenCount).toBe(0);
    expect((await run(tight, {}, { minConnectSameAirlineMin: 30 })).hiddenCount).toBe(1);
  });

  it('reports 0 hidden when the market has no flights that day', async () => {
    const out = await run([flight('X', 'AA', 'BNA', 'LAX', '09:00', 260, '2026-10-21')], { maxStops: 0 }, { maxStops: 3 });
    expect(out).toEqual({ results: [], hiddenCount: 0, hiddenResults: [] });
  });

  it('caps hidden results at the limit but counts them all', async () => {
    const many = [flight('a', 'AA', 'BNA', 'DFW', '08:00', 120), ...[0, 1, 2].map((i) => flight(`b${i}`, 'AA', 'DFW', 'LAX', `1${1 + i}:00`, 180))];
    const out = await run(many, { maxStops: 0, limit: 2 }, { maxStops: 3 });
    expect(out.hiddenCount).toBe(3);
    expect(out.hiddenResults).toHaveLength(2);
  });
});

describe('toRouteLine', () => {
  it('maps to the globe contract with [lon, lat] and per-leg tier/source', async () => {
    const provider = createMemoryProvider(
      [flight('a', 'AA', 'BNA', 'DFW', '06:00', 125), flight('b', 'AA', 'DFW', 'LAX', '09:30', 200)],
      { a: seats('estimate', 20) },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW });
    const line = toRouteLine(it, provider.getAirport);
    expect(line.id).toBe(it.id);
    expect(line.legs[0]).toEqual({
      id: 'a',
      from: [-86.6774, 36.1263],
      to: [-97.0403, 32.8998],
      fromCode: 'BNA',
      toCode: 'DFW',
      tier: 'good',
      source: 'estimate',
      departUtc: it.legs[0].flight.departUtc,
      arriveUtc: it.legs[0].flight.arriveUtc,
    });
    expect(line.legs[1]).toMatchObject({ tier: 'unknown', source: 'unknown' });
  });
});

describe('sample provider', () => {
  it('returns sorted BNA->LAX options with mixed sources', async () => {
    const provider = createSampleProvider(DATE, 8, NOW);
    const result = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: DATE }, { now: NOW });
    expect(result.length).toBeGreaterThan(3);
    expect(result.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < result.length; i++) expect(result[i].arriveUtc).toBeGreaterThanOrEqual(result[i - 1].arriveUtc);
    expect(result.some((r) => r.stops === 0)).toBe(true);
    expect(result.some((r) => r.stops > 0)).toBe(true);
  });
});
