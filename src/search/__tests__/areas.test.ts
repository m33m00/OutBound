import { createMemoryProvider, searchItineraries, zonedToUtc, type Flight } from '@/engine';
import { homeAirports } from '@/settings/settings';

import { searchRequest } from '../areas';

const DATE = '2026-10-20';
const NOW = Date.UTC(2026, 9, 19, 12);
const flight = (id: string, to: string): Flight => {
  const departUtc = zonedToUtc(DATE, '09:00', 'America/Los_Angeles');
  return { id, airline: 'AA', flightNumber: id, from: 'LAX', to, departUtc, arriveUtc: departUtc + 180 * 60_000 };
};

describe('searchRequest (Q-048)', () => {
  it('uses each airport’s remembered toggle, off when unset', () => {
    expect(searchRequest('DFW', 'LAX', DATE, {})).toMatchObject({ originArea: false, destinationArea: false });
    expect(searchRequest('DFW', 'DAL', DATE, { DFW: true, DAL: false })).toMatchObject({
      originArea: true,
      destinationArea: false,
    });
  });

  it('Get Home searches the whole home area even with its toggle off', async () => {
    const req = searchRequest('LAX', 'DFW', DATE, { DFW: false }, true);
    expect(req.destinationArea).toBe(true);
    const flights = [flight('dfw', 'DFW'), flight('dal', 'DAL')];
    const results = await searchItineraries(createMemoryProvider(flights, {}), req, { now: NOW });
    expect(results.map((r) => r.id).sort()).toEqual(['dal', 'dfw']);
    // Same airports as the home list adds automatically.
    expect(homeAirports({ main: 'DFW', extras: [] }).map((h) => h.code)).toEqual(['DFW', 'DAL']);
  });
});
