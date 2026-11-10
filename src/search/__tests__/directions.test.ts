import { AIRPORTS } from '@/engine';

import { airportQuery, directionsUrls, gateQuery } from '../directions';

describe('directions to the airport', () => {
  it('searches the airport by name and code so the route ends at the terminal', () => {
    expect(airportQuery(AIRPORTS.DAL)).toBe('Dallas Love Field Airport (DAL)');
  });

  it('opens Apple Maps driving directions by default', () => {
    const [url, ...rest] = directionsUrls(AIRPORTS.DAL, 'apple');
    expect(rest).toEqual([directionsUrls(AIRPORTS.DAL, 'google')[1]]);
    expect(url.startsWith('https://maps.apple.com/?daddr=Dallas%20Love%20Field%20Airport%20(DAL)')).toBe(true);
    expect(url).toContain('dirflg=d');
  });

  it('tries the Google Maps app, then the Google Maps web page', () => {
    const urls = directionsUrls(AIRPORTS.DAL, 'google');
    expect(urls).toHaveLength(2);
    expect(urls[0].startsWith('comgooglemaps://?daddr=')).toBe(true);
    expect(urls[1].startsWith('https://www.google.com/maps/dir/?api=1&destination=')).toBe(true);
  });

  it('always uses Google Maps on Android', () => {
    expect(directionsUrls(AIRPORTS.DAL, 'apple', false)).toEqual([directionsUrls(AIRPORTS.DAL, 'google')[1]]);
  });

  it('walks to the gate once you are at the airport (round 159, John)', () => {
    const t = { gate: 'C12', terminal: 'C' };
    expect(gateQuery(AIRPORTS.DFW, t)).toBe('DFW Terminal C Gate C12');
    expect(gateQuery(AIRPORTS.DFW, { gate: '12', terminal: null })).toBe('DFW Gate 12');
    expect(gateQuery(AIRPORTS.DFW, { gate: null, terminal: null })).toBe(airportQuery(AIRPORTS.DFW));
    const [apple, web] = directionsUrls(AIRPORTS.DFW, 'apple', true, t);
    expect(apple).toContain('dirflg=w');
    expect(apple).toContain(encodeURIComponent('DFW Terminal C Gate C12'));
    expect(web).toContain('travelmode=walking');
    expect(directionsUrls(AIRPORTS.DFW, 'google', true, t)[0]).toContain('directionsmode=walking');
    // Driving stays driving.
    expect(directionsUrls(AIRPORTS.DFW, 'apple')[0]).toContain('dirflg=d');
  });
});
