import { changedFilters, DEFAULT_FILTERS, DEFAULT_SETTINGS, parseSettings } from '../settings';

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
      bufferMin: 90,
      useLocation: true,
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
