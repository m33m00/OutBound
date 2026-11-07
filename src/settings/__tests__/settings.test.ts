import { changedFilters, DEFAULT_FILTERS, DEFAULT_SETTINGS, homeAirports, parseSettings } from '../settings';

describe('parseSettings', () => {
  it('gives defaults for nothing or junk', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ bufferMin: 'x', useLocation: 1, search: 7 })).toEqual(DEFAULT_SETTINGS);
  });

  it('starts with notifications off and keeps saved choices', () => {
    expect(DEFAULT_SETTINGS.notify).toEqual({ answers: false, airlineAsks: false });
    expect(parseSettings({ notify: { answers: false, airlineAsks: true } }).notify).toEqual({
      answers: false,
      airlineAsks: true,
    });
    expect(parseSettings({ notify: { answers: 'no' } }).notify).toEqual({ answers: false, airlineAsks: false });
  });

  it('opens directions in Apple Maps unless Google Maps was picked', () => {
    expect(DEFAULT_SETTINGS.mapsApp).toBe('apple');
    expect(parseSettings({ mapsApp: 'google' }).mapsApp).toBe('google');
    expect(parseSettings({ mapsApp: 'waze' }).mapsApp).toBe('apple');
  });

  it('defaults the airport buffer to 75 min (Q-003)', () => {
    expect(DEFAULT_SETTINGS.bufferMin).toBe(75);
  });

  it('keeps valid saved values', () => {
    const saved = {
      homes: { main: 'DFW', extras: ['ORD'] },
      bufferMin: 90,
      useLocation: true,
      locationAsked: true,
      lastOrigin: 'DAL',
      radarOn: false,
      search: { ...DEFAULT_FILTERS, maxStops: 1, maxLayoverMin: 300 },
      areaOn: { DAL: true, DFW: false },
      notify: { answers: true, airlineAsks: false },
      mapsApp: 'google',
      appearance: 'dark',
      membership: 'payg',
    };
    expect(parseSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('keeps the plan once picked and asks again when there is none (round 176)', () => {
    expect(DEFAULT_SETTINGS.membership).toBeNull();
    expect(parseSettings({ membership: 'premium' }).membership).toBe('premium');
    expect(parseSettings({ membership: 'gold' }).membership).toBeNull();
    expect(parseSettings({}).membership).toBeNull();
  });

  it('follows the phone unless Light or Dark was picked (round 173)', () => {
    expect(DEFAULT_SETTINGS.appearance).toBe('system');
    expect(parseSettings({}).appearance).toBe('system');
    expect(parseSettings({ appearance: 'light' }).appearance).toBe('light');
    expect(parseSettings({ appearance: 'dark' }).appearance).toBe('dark');
    expect(parseSettings({ appearance: 'sepia' }).appearance).toBe('system');
    expect(parseSettings({ appearance: 1 }).appearance).toBe('system');
  });

  it('clamps and snaps out-of-range values', () => {
    const s = parseSettings({ bufferMin: 500, search: { maxStops: 9, minConnectSwitchMin: 92, maxLayoverMin: -5 } });
    expect(s.bufferMin).toBe(180);
    expect(s.search.maxStops).toBe(3);
    expect(s.search.minConnectSwitchMin).toBe(90);
    expect(s.search.maxLayoverMin).toBe(60);
    expect(parseSettings({ bufferMin: 12 }).bufferMin).toBe(30);
  });

  it('loads old saves without the backlog 23 keys (Q-051)', () => {
    const old = { homes: { main: 'DFW', extras: [] }, bufferMin: 90, useLocation: false, radarOn: true };
    const s = parseSettings(old);
    expect(s.locationAsked).toBe(false);
    expect(s.lastOrigin).toBeNull();
    expect(s.homes.main).toBe('DFW');
    expect(s.bufferMin).toBe(90);
  });

  it('counts location already on as asked, so the launch card never shows (Q-051)', () => {
    expect(parseSettings({ useLocation: true }).locationAsked).toBe(true);
    // Turning location off later keeps it asked.
    expect(parseSettings({ useLocation: false, locationAsked: true }).locationAsked).toBe(true);
  });

  it('drops an unknown last origin', () => {
    expect(parseSettings({ lastOrigin: 'ZZZ' }).lastOrigin).toBeNull();
    expect(parseSettings({ lastOrigin: 42 }).lastOrigin).toBeNull();
    expect(parseSettings({ lastOrigin: 'ORD' }).lastOrigin).toBe('ORD');
  });

  it('fills missing search fields from defaults', () => {
    expect(parseSettings({ search: { maxStops: 0 } }).search).toEqual({ ...DEFAULT_FILTERS, maxStops: 0 });
  });
});

describe('changedFilters', () => {
  it('counts differences from the saved defaults', () => {
    expect(changedFilters(DEFAULT_FILTERS)).toBe(0);
    expect(changedFilters({ ...DEFAULT_FILTERS, maxStops: 1, maxLayoverMin: 300 })).toBe(2);
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

  it('lists main first, adds the rest of its area, then extras', () => {
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

describe('old settings (Q-048, Q-052)', () => {
  it('loads saved nearbyAirports and maxGroundTransferMin without crashing, ignoring them', () => {
    const old = {
      bufferMin: 90,
      search: { maxStops: 2, nearbyAirports: false, maxGroundTransferMin: 45, maxLayoverMin: 300 },
    };
    const s = parseSettings(JSON.parse(JSON.stringify(old)));
    expect(s.search).toEqual({ ...DEFAULT_FILTERS, maxStops: 2, maxLayoverMin: 300 });
    expect(s.bufferMin).toBe(90);
    expect(s.areaOn).toEqual({});
  });
});

describe('area toggle memory (Q-048)', () => {
  it('is off by default', () => {
    expect(DEFAULT_SETTINGS.areaOn).toEqual({});
  });

  it('remembers the last choice per airport and drops junk', () => {
    const s = parseSettings({ areaOn: { DAL: true, DFW: false, XXX: true, ORD: 'yes' } });
    expect(s.areaOn).toEqual({ DAL: true, DFW: false });
    expect(parseSettings({ areaOn: 'nope' }).areaOn).toEqual({});
  });
});

describe('round 174 filters in saved defaults', () => {
  it('keeps valid picks and drops anything else', () => {
    const s = parseSettings({
      search: {
        departTimes: ['night', 'morning', 'noon', 'morning'],
        avoidAirports: ['ORD', 'XXX', 'ORD', 4],
        answeredOnly: true,
        airlines: ['WN', 'wn', 'UA', 'WN', 'TOOLONG'],
        airlineRegion: 'us',
      },
    }).search;
    expect(s.departTimes).toEqual(['morning', 'night']);
    expect(s.avoidAirports).toEqual(['ORD']);
    expect(s.answeredOnly).toBe(true);
    expect(s.airlines).toEqual(['WN', 'UA']);
    expect(s.airlineRegion).toBe('us');
  });

  it('old saves get the open defaults', () => {
    const s = parseSettings({ search: { maxStops: 1 } }).search;
    expect(s).toMatchObject({ departTimes: [], avoidAirports: [], answeredOnly: false, airlines: [], airlineRegion: 'all' });
  });

  it('counts each changed filter once, lists in any order', () => {
    expect(changedFilters({ ...DEFAULT_FILTERS, departTimes: [], airlines: [] })).toBe(0);
    expect(changedFilters({ ...DEFAULT_FILTERS, departTimes: ['morning', 'night'], answeredOnly: true })).toBe(2);
    const saved = { ...DEFAULT_FILTERS, airlines: ['WN', 'UA'] };
    expect(changedFilters({ ...DEFAULT_FILTERS, airlines: ['UA', 'WN'] }, saved)).toBe(0);
    expect(changedFilters({ ...DEFAULT_FILTERS, airlines: ['UA'] }, saved)).toBe(1);
  });
});
