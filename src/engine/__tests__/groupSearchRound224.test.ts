/** Round 224: a whole country, state or city as From or To (John: "include those options of airports in the search"). */
import { AIRPORTS } from '../airports';
import { createMemoryProvider } from '../memoryProvider';
import { createSampleProvider } from '../sample/sampleProvider';
import { searchItineraries, searchRoutes } from '../search';
import type { PlaceRef } from '../types';

import { DATE, NOW, flight } from '../testHelpers';

const place = (key: string, name: string, airports: string[]): PlaceRef => ({ key, name, airports });
const SPAIN = place('country:ES', 'Spain', ['BCN', 'MAD']);
const TEXAS = place('region:US-TX', 'Texas', ['AUS', 'DAL', 'DFW', 'HOU', 'IAH']);

describe('searching a place (round 224)', () => {
  const flights = [
    flight('dfw-mad', 'AA', 'DFW', 'MAD', '17:00', 600),
    flight('iah-bcn', 'UA', 'IAH', 'LHR', '16:00', 570),
    flight('lhr-bcn', 'BA', 'LHR', 'BCN', '13:00', 130, '2026-11-02'),
    flight('aus-dfw', 'AA', 'AUS', 'DFW', '12:00', 60),
    flight('bna-dfw', 'AA', 'BNA', 'DFW', '12:00', 120),
  ];
  const run = (origin: string, destination: string, groups: { originGroup?: PlaceRef; destinationGroup?: PlaceRef }) =>
    searchItineraries(createMemoryProvider(flights), { origin, destination, date: DATE, ...groups }, { now: NOW });

  it('leaves from any airport in the place and lands at any in the other', async () => {
    const found = await run('AUS', 'BCN', { originGroup: TEXAS, destinationGroup: SPAIN });
    const paths = found.map((it) => it.pathKey);
    expect(paths).toContain('DFW>MAD');
    expect(found.find((it) => it.pathKey === 'DFW>MAD')).toMatchObject({ requestedOrigin: 'DFW', requestedDestination: 'MAD' });
  });

  it('never connects through another airport in the same place, so each airport shows its own routes', async () => {
    const found = await run('AUS', 'BCN', { originGroup: TEXAS, destinationGroup: SPAIN });
    expect(found.map((it) => it.pathKey)).not.toContain('AUS>DFW>MAD');
    // From outside Texas, Dallas is a fine place to connect.
    const fromBna = await run('BNA', 'BCN', { destinationGroup: SPAIN });
    expect(fromBna.map((it) => it.pathKey)).toContain('BNA>DFW>MAD');
  });

  it('finds the sample routes from the United States to Madrid', async () => {
    const us = Object.values(AIRPORTS)
      .filter((a) => a.country === 'US')
      .map((a) => a.code)
      .sort();
    const outcome = await searchRoutes(
      createSampleProvider('2026-11-18', 8, Date.UTC(2026, 10, 18, 6)),
      { origin: us[0], destination: 'MAD', date: '2026-11-18', originGroup: place('country:US', 'United States', us) },
      { now: Date.UTC(2026, 10, 18, 6) },
    );
    const from = new Set(outcome.results.map((it) => it.legs[0].flight.from));
    expect(from.size).toBeGreaterThan(2);
    for (const it of outcome.results) expect(it.legs[it.legs.length - 1].flight.to).toBe('MAD');
  });
});
