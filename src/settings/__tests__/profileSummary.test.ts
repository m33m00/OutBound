import { DEFAULT_SETTINGS, type Settings } from '../settings';
import { parseSettingsSection, profileSummary, settingsSectionFor, stopsText } from '../profileSummary';

const row = (s: Settings, key: string) => profileSummary(s).find((r) => r.key === key)!;

describe('stopsText', () => {
  it('words each stop count', () => {
    expect(stopsText(0)).toBe('Nonstop only');
    expect(stopsText(1)).toBe('Up to 1 stop');
    expect(stopsText(3)).toBe('Up to 3 stops');
  });
});

describe('profileSummary', () => {
  it('shows defaults when nothing is set', () => {
    const s = DEFAULT_SETTINGS;
    expect(row(s, 'home').value).toBe('Not set');
    expect(row(s, 'otherHomes').value).toBe('None');
    expect(row(s, 'buffer').value).toBe('75 min');
    expect(row(s, 'location').value).toBe('Off');
    expect(row(s, 'search').value).toBe('Up to 3 stops');
  });

  it('names the main home and lists area and extra homes', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, homes: { main: 'DAL', extras: ['LAX'] }, useLocation: true };
    expect(row(s, 'home').value).toBe('DAL');
    expect(row(s, 'home').detail).toMatch(/Love/);
    // DFW is in DAL's area, so it's added automatically before extras.
    expect(row(s, 'otherHomes').value).toBe('DFW, LAX');
    expect(row(s, 'location').value).toBe('On');
  });

  it('says which notifications are on', () => {
    const on = (answers: boolean, airlineAsks: boolean) =>
      row({ ...DEFAULT_SETTINGS, notify: { answers, airlineAsks } }, 'notify').value;
    expect(on(true, true)).toBe('On');
    expect(on(true, false)).toBe('Answers only');
    expect(on(false, true)).toBe('Airline asks only');
    expect(on(false, false)).toBe('Off');
  });

  it('keeps rows in a fixed order', () => {
    expect(profileSummary(DEFAULT_SETTINGS).map((r) => r.key)).toEqual([
      'home',
      'otherHomes',
      'location',
      'notify',
      'buffer',
      'search',
    ]);
  });
});

describe('Profile rows open Settings at their section (backlog 56)', () => {
  it('every row has a section', () => {
    for (const row of profileSummary(DEFAULT_SETTINGS)) {
      expect(['homes', 'location', 'notify', 'leaveBy', 'search']).toContain(settingsSectionFor(row.key));
    }
    expect(settingsSectionFor('otherHomes')).toBe('homes');
    expect(settingsSectionFor('buffer')).toBe('leaveBy');
  });

  it('reads only known sections from the link', () => {
    expect(parseSettingsSection('search')).toBe('search');
    expect(parseSettingsSection(['location'])).toBe('location');
    expect(parseSettingsSection('notify')).toBe('notify');
    expect(parseSettingsSection('nope')).toBeNull();
    expect(parseSettingsSection(undefined)).toBeNull();
  });
});
