import { AIRPORTS } from '@/engine';

import { airportQuery, directionsUrls } from '../directions';

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
});
