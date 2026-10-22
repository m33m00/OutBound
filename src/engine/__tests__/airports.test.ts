import { AIRPORTS, AREA_TABLE, areaFor, endAirports, transferMin } from '../airports';

const known = (...codes: string[]) => Object.fromEntries(codes.map((c) => [c, true]));

describe('areaFor (Q-048)', () => {
  it('finds Dallas from either airport in the app data', () => {
    expect(areaFor('DAL')).toEqual({ city: 'Dallas', airports: ['DAL', 'DFW'] });
    expect(areaFor('DFW')).toEqual({ city: 'Dallas', airports: ['DAL', 'DFW'] });
  });

  it('needs 2+ airports in the data', () => {
    // LGA, ORD, LAX and MIA are in the data, but their area partners are not yet.
    for (const code of ['LGA', 'ORD', 'LAX', 'MIA', 'BNA']) expect(areaFor(code)).toBeNull();
    expect(areaFor('JFK')).toBeNull(); // not in the data at all
  });

  it('counts only known airports, in table order', () => {
    expect(areaFor('LAX', known('LAX', 'SNA', 'BUR'))).toEqual({ city: 'Los Angeles', airports: ['LAX', 'BUR', 'SNA'] });
    expect(areaFor('LAX', known('LAX', 'BUR', 'LGB', 'SNA', 'ONT'))?.airports).toHaveLength(5);
    expect(areaFor('BUR', known('LAX'))).toBeNull();
  });

  it('lists each airport in one area only', () => {
    const all = AREA_TABLE.flatMap((a) => a.airports);
    expect(new Set(all).size).toBe(all.length);
  });

  it('only returns airports in the app data by default', () => {
    for (const code of Object.keys(AIRPORTS)) {
      for (const a of areaFor(code)?.airports ?? []) expect(a in AIRPORTS).toBe(true);
    }
  });
});

describe('transfer minutes', () => {
  it('keeps DAL<->DFW at 35 in either order, unknown pairs null', () => {
    expect(transferMin('DAL', 'DFW')).toBe(35);
    expect(transferMin('DFW', 'DAL')).toBe(35);
    expect(transferMin('DFW', 'DFW')).toBe(0);
    expect(transferMin('LAX', 'BUR')).toBeNull();
  });
});

describe('endAirports', () => {
  it('is exactly the airport when the toggle is off', () => {
    expect(endAirports('DFW', false)).toEqual([['DFW', 0]]);
  });

  it('adds the rest of the area when on', () => {
    expect(endAirports('DFW', true)).toEqual([
      ['DFW', 0],
      ['DAL', 35],
    ]);
    expect(endAirports('BNA', true)).toEqual([['BNA', 0]]);
  });
});
