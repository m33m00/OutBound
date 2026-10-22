import { matchAirports, SEARCH_AIRPORTS } from '../airports';
import { dateChips, fromPickerDate, QUICK_DATE_CHIPS, shortDate, toPickerDate } from '../dates';

describe('matchAirports', () => {
  it('returns everything for an empty query', () => {
    expect(matchAirports('  ')).toHaveLength(SEARCH_AIRPORTS.length);
  });
  it('puts an exact code first, then prefixes, then names', () => {
    expect(matchAirports('dal').map((a) => a.code)).toEqual(['DAL', 'DFW']); // DFW name has "Dallas"
    expect(matchAirports('D').map((a) => a.code).slice(0, 3)).toEqual(['DAL', 'DEN', 'DFW']);
  });
  it('matches city names case-insensitively', () => {
    expect(matchAirports('nash').map((a) => a.code)).toEqual(['BNA']);
  });
  it('returns nothing for no match', () => {
    expect(matchAirports('zzz')).toEqual([]);
  });
});

describe('dateChips', () => {
  it('offers today through 7 days out', () => {
    const chips = dateChips('2026-10-14');
    expect(chips).toHaveLength(8);
    expect(chips[0]).toEqual({ date: '2026-10-14', label: 'Today', long: 'Wednesday, October 14' });
    expect(chips[1].label).toBe('Tomorrow');
    expect(chips[2].label).toBe('Fri 16');
    expect(chips[7].date).toBe('2026-10-21');
  });
  it('crosses month ends', () => {
    expect(dateChips('2026-10-30')[3].date).toBe('2026-11-02');
  });
  it('formats short dates', () => {
    expect(shortDate('2026-10-14')).toBe('Wed, Oct 14');
  });
});

describe('calendar dates', () => {
  it('gives chips to today plus the next three days', () => {
    expect(dateChips('2026-10-14').slice(0, QUICK_DATE_CHIPS).map((c) => c.label)).toEqual([
      'Today',
      'Tomorrow',
      'Fri 16',
      'Sat 17',
    ]);
  });
  it('round-trips picker dates as calendar days', () => {
    expect(fromPickerDate(toPickerDate('2026-11-02'))).toBe('2026-11-02');
    expect(fromPickerDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
