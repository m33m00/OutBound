import { createMemoryProvider, searchItineraries, zonedToUtc, type Flight } from '@/engine';
import { homeAirports } from '@/settings/settings';

import { otherEndExcludes, searchRequest, showGetHome } from '../areas';

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

  it('Get Home shows away from home, but not once To is already home (John, 2026-11-01)', () => {
    const homes = homeAirports({ main: 'DAL', extras: [] });
    expect(showGetHome(homes, 'LAX', null)).toBe(true);
    expect(showGetHome(homes, 'LAX', 'DEN')).toBe(true);
    // To already home, its own code or another airport in the home area: Find Routes is the one button.
    expect(showGetHome(homes, 'LAX', 'DAL')).toBe(false);
    expect(showGetHome(homes, 'LAX', 'DFW')).toBe(false);
    // At home, or no home set.
    expect(showGetHome(homes, 'DFW', null)).toBe(false);
    expect(showGetHome([], 'LAX', null)).toBe(false);
    expect(showGetHome(homes, null, null)).toBe(false);
  });
});

describe('the other end leaves out this end’s area (round 138, John: no Dallas to Dallas)', () => {
  it('leaves out every airport in the area, both ways', () => {
    expect(otherEndExcludes('DAL').sort()).toEqual(['DAL', 'DFW']);
    expect(otherEndExcludes('DFW').sort()).toEqual(['DAL', 'DFW']);
    expect(otherEndExcludes('BNA')).toEqual(['BNA']);
    expect(otherEndExcludes(null)).toEqual([]);
  });
});
