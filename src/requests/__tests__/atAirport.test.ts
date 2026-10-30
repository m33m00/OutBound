import { AIRPORTS } from '@/engine';

import {
  AT_AIRPORT_FRESH_MS,
  airportYouAreAt,
  atAirportNote,
  DEPARTURES_AHEAD_MS,
  DEPARTURES_BEHIND_MS,
  sampleDepartures,
} from '../atAirport';

const NOW = Date.UTC(2026, 9, 30, 15);

describe('at the airport (round 33)', () => {
  it('within 4 km of an airport with a fresh fix', () => {
    const dal = AIRPORTS.DAL;
    expect(airportYouAreAt({ lat: dal.lat, lon: dal.lon, at: NOW }, NOW)).toBe('DAL');
    // About 2 km north still counts.
    expect(airportYouAreAt({ lat: dal.lat + 0.018, lon: dal.lon, at: NOW }, NOW)).toBe('DAL');
    // About 10 km away does not.
    expect(airportYouAreAt({ lat: dal.lat + 0.09, lon: dal.lon, at: NOW }, NOW)).toBeNull();
  });

  it('an old fix or none says nothing', () => {
    const dal = AIRPORTS.DAL;
    expect(airportYouAreAt({ lat: dal.lat, lon: dal.lon, at: NOW - AT_AIRPORT_FRESH_MS - 1 }, NOW)).toBeNull();
    expect(airportYouAreAt(null, NOW)).toBeNull();
  });

  it('the board: that airport only, 30 minutes back to 5 hours ahead, your airline first', () => {
    for (const code of ['DAL', 'DFW', 'LAX']) {
      const list = sampleDepartures(code, NOW, 'WN');
      for (const f of list) {
        expect(f.from).toBe(code);
        expect(f.departUtc).toBeGreaterThanOrEqual(NOW - DEPARTURES_BEHIND_MS);
        expect(f.departUtc).toBeLessThanOrEqual(NOW + DEPARTURES_AHEAD_MS);
      }
      const firstOther = list.findIndex((f) => f.airline !== 'WN');
      if (firstOther >= 0) expect(list.slice(firstOther).every((f) => f.airline !== 'WN')).toBe(true);
    }
    expect(sampleDepartures('DAL', NOW).length + sampleDepartures('DFW', NOW).length).toBeGreaterThan(0);
  });

  it('card line counts departures, or says there are none', () => {
    expect(atAirportNote('DAL', 4)).toBe('4 departures in the next 5 hours. Pick yours from the board.');
    expect(atAirportNote('DAL', 1)).toContain('1 departure in');
    expect(atAirportNote('DAL', 0)).toBe('No more departures from DAL in the next 5 hours.');
  });
});
