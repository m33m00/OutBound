import { changedFilters, DEFAULT_FILTERS, DEFAULT_SETTINGS, homeAirports, parseSettings } from '../settings';

describe('parseSettings', () => {
  it('gives defaults for nothing or junk', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ bufferMin: 'x', useLocation: 1, search: 7 })).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults the airport buffer to 75 min (Q-003)', () => {
    expect(DEFAULT_SETTINGS.bufferMin).toBe(75);
  });

  it('keeps valid saved values', () => {
    const saved = {
      homes: { main: 'DFW', extras: ['ORD'] },
      bufferMin: 90,
      useLocation: true,
      radarOn: false,
      search: { ...DEFAULT_FILTERS, maxStops: 1, nearbyAirports: false, maxLayoverMin: 300 },
    };
    expect(parseSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('clamps and snaps out-of-range values', () => {
    const s = parseSettings({ bufferMin: 500, search: { maxStops: 9, minConnectSwitchMin: 92, maxLayoverMin: -5 } });
    expect(s.bufferMin).toBe(180);
    expect(s.search.maxStops).toBe(3);
    expect(s.search.minConnectSwitchMin).toBe(90);
    expect(s.search.maxLayoverMin).toBe(60);
    expect(parseSettings({ bufferMin: 12 }).bufferMin).toBe(30);
  });

  it('fills missing search fields from defaults', () => {
    expect(parseSettings({ search: { maxStops: 0 } }).search).toEqual({ ...DEFAULT_FILTERS, maxStops: 0 });
  });
});

describe('changedFilters', () => {
  it('counts differences from the saved defaults', () => {
    expect(changedFilters(DEFAULT_FILTERS)).toBe(0);
    expect(changedFilters({ ...DEFAULT_FILTERS, maxStops: 1, nearbyAirports: false })).toBe(2);
    const saved = { ...DEFAULT_FILTERS, maxStops: 1 };
    expect(changedFilters(saved, saved)).toBe(0);
  });
});

describe('homes (Q-026)', () => {
  it('defaults to no home', () => {
    expect(DEFAULT_SETTINGS.homes).toEqual({ main: null, extras: [] });
  });

  it('drops unknown airports, duplicates and an extra equal to main', () => {
    expect(parseSettings({ homes: { main: 'XXX', extras: ['LAX', 'LAX', 'ZZZ'] } }).homes).toEqual({
      main: null,
      extras: ['LAX'],
    });
    expect(parseSettings({ homes: { main: 'DFW', extras: ['DFW', 'ORD'] } }).homes).toEqual({
      main: 'DFW',
      extras: ['ORD'],
    });
  });

  it('lists main first, adds same-group nearby airports, then extras', () => {
    expect(homeAirports({ main: 'DFW', extras: ['ORD', 'DAL'] })).toEqual([
      { code: 'DFW', main: true, auto: false },
      { code: 'DAL', main: false, auto: true },
      { code: 'ORD', main: false, auto: false },
    ]);
    expect(homeAirports({ main: 'BNA', extras: [] })).toEqual([{ code: 'BNA', main: true, auto: false }]);
  });

  it('works with extras but no main', () => {
    expect(homeAirports({ main: null, extras: ['SEA'] })).toEqual([{ code: 'SEA', main: false, auto: false }]);
  });
});

describe('radar setting (Q-032)', () => {
  it('is on by default and remembered', () => {
    expect(DEFAULT_SETTINGS.radarOn).toBe(true);
    expect(parseSettings({ radarOn: false }).radarOn).toBe(false);
    expect(parseSettings({ radarOn: 'no' }).radarOn).toBe(true);
  });
});
