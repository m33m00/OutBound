/** Round 224: countries, states and cities in the airport picker, and where the globe rests for them. */
import { AIRPORTS, type Airport } from '@/engine';
import { previewLines, PREVIEW_MAX, type PreviewEnd } from '@/map/previewLines';

import { searchAirports } from '../airports';
import { otherEndExcludes, searchRequest } from '../areas';
import { allPlaces, findPlace, matchPlaces, placeCodes, placeRef, placeTree, restBetween } from '../places';

const all = searchAirports(false);
const tree = placeTree(all);
const names = (kids: { place?: { name: string }; airport?: Airport }[]) =>
  kids.map((k) => (k.place ? k.place.name : k.airport!.code));

describe('place tree', () => {
  it('lists countries with the United States first, then A to Z', () => {
    expect(tree.map((p) => p.name)).toEqual(['United States', 'Canada', 'Japan', 'Mexico', 'Spain', 'United Kingdom']);
    expect(tree[0].airports).toHaveLength(all.filter((a) => a.country === 'US').length);
  });

  it('goes country, state, city, airport in the US, and country, city, airport elsewhere', () => {
    const texas = findPlace(tree, 'region:US-TX')!;
    expect(texas.name).toBe('Texas');
    expect(names(texas.children)).toEqual(['AUS', 'Dallas', 'Houston']);
    expect(names(findPlace(tree, 'city:US-TX-Dallas')!.children)).toEqual(['DAL', 'DFW']);
    expect(names(findPlace(tree, 'country:ES')!.children)).toEqual(['BCN', 'MAD']);
    expect(findPlace(tree, 'country:ES')!.airports).toEqual(['BCN', 'MAD']);
  });

  it('skips a level with only one place in it, and a one-airport place is that airport', () => {
    // Illinois is just Chicago, so it opens straight onto O'Hare and Midway.
    const illinois = findPlace(tree, 'region:US-IL')!;
    expect(names(illinois.children)).toEqual(['MDW', 'ORD']);
    expect(findPlace(tree, 'city:US-IL-Chicago')).toBeNull();
    // Arizona has one airport: a place row that picks PHX.
    expect(findPlace(tree, 'region:US-AZ')!.airports).toEqual(['PHX']);
    // Every place points back up to the one it's in.
    for (const p of allPlaces(tree)) if (p.parent) expect(findPlace(tree, p.parent)).not.toBeNull();
  });

  it('is built from the airports this end offers, so no place is empty', () => {
    const noDallas = placeTree(all.filter((a) => !otherEndExcludes('DAL').includes(a.code)));
    expect(findPlace(noDallas, 'city:US-TX-Dallas')).toBeNull();
    expect(findPlace(noDallas, 'region:US-TX')!.airports).toEqual(['AUS', 'HOU', 'IAH']);
    // With live schedules on, only the airports the live pull covers: no Spain at all.
    expect(placeTree(searchAirports(true)).map((p) => p.name)).toEqual(['United States']);
  });

  it('finds places by name as you type, countries first', () => {
    expect(matchPlaces(tree, 'spa').map((p) => p.name)).toEqual(['Spain']);
    expect(matchPlaces(tree, 'new york').map((p) => p.key)).toEqual(['region:US-NY']);
    expect(matchPlaces(tree, 'tex').map((p) => p.name)).toEqual(['Texas']);
    expect(matchPlaces(tree, 'united').map((p) => p.name)).toEqual(['United Kingdom', 'United States']);
    expect(matchPlaces(tree, 'es').map((p) => p.name)).toEqual(['Spain']);
    expect(matchPlaces(tree, '')).toEqual([]);
  });

  it('says a place by its codes while short, then by count', () => {
    expect(placeCodes(['BCN', 'MAD'])).toBe('BCN, MAD');
    expect(placeCodes(tree[0].airports)).toBe(`${tree[0].airports.length} airports`);
    expect(placeRef(findPlace(tree, 'country:ES')!)).toEqual({ key: 'country:ES', name: 'Spain', airports: ['BCN', 'MAD'] });
  });
});

describe('searching a place', () => {
  const spain = placeRef(findPlace(tree, 'country:ES')!);
  it('sends the place with the request, and no area toggle on that end', () => {
    expect(searchRequest('DAL', 'BCN', '2026-11-18', { BCN: true, DAL: true }, undefined, { destination: spain })).toEqual({
      origin: 'DAL',
      destination: 'BCN',
      date: '2026-11-18',
      originArea: true,
      destinationArea: false,
      destinationGroup: spain,
    });
  });
  it('leaves every airport in the place out of the other end', () => {
    expect(otherEndExcludes('BCN', spain).sort()).toEqual(['BCN', 'MAD']);
    const texas = placeRef(findPlace(tree, 'region:US-TX')!);
    expect(otherEndExcludes('AUS', texas).sort()).toEqual(['AUS', 'DAL', 'DFW', 'HOU', 'IAH']);
  });
});

describe('preview lines', () => {
  const end = (code: string): PreviewEnd => ({
    code,
    coord: [AIRPORTS[code].lon, AIRPORTS[code].lat],
    city: AIRPORTS[code].city,
  });
  const us = tree[0].airports.map(end);

  it('one line between two airports', () => {
    expect(previewLines([end('DAL')], [end('MAD')]).map((l) => `${l.from.code}-${l.to.code}`)).toEqual(['DAL-MAD']);
  });

  it(`a fan of at most ${PREVIEW_MAX} from across the United States to Madrid, one per city`, () => {
    const lines = previewLines(us, [end('MAD')]);
    expect(lines).toHaveLength(PREVIEW_MAX);
    for (const l of lines) expect(l.to.code).toBe('MAD');
    const cities = lines.map((l) => l.from.city);
    expect(new Set(cities).size).toBe(cities.length);
    // Spread to the edges: the west coast and the east coast both get one.
    expect(lines.some((l) => l.from.coord[0] < -115)).toBe(true);
    expect(lines.some((l) => l.from.coord[0] > -82)).toBe(true);
  });

  it('every airport on the smaller side gets a line, so Spain shows Barcelona too', () => {
    const lines = previewLines(us, [end('MAD'), end('BCN')]);
    expect(new Set(lines.map((l) => l.to.code))).toEqual(new Set(['MAD', 'BCN']));
    const back = previewLines([end('MAD'), end('BCN')], us);
    expect(new Set(back.map((l) => l.from.code))).toEqual(new Set(['MAD', 'BCN']));
  });

  it('rests the globe halfway between the two sides', () => {
    const [lon, lat] = restBetween(tree[0].airports, ['MAD']);
    expect(lon).toBeGreaterThan(-60);
    expect(lon).toBeLessThan(-30);
    expect(lat).toBeGreaterThan(35);
    expect(restBetween(['DAL', 'DFW'], [])[0]).toBeCloseTo((AIRPORTS.DAL.lon + AIRPORTS.DFW.lon) / 2);
  });
});
