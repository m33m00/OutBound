import { addDays, daysBetween, localDate, tzOffsetMin, zonedToUtc } from '../time';

describe('time helpers', () => {
  it('converts local wall time to UTC across zones', () => {
    // October: Chicago is CDT (UTC-5), Phoenix has no DST (UTC-7).
    expect(zonedToUtc('2026-10-20', '06:10', 'America/Chicago')).toBe(Date.UTC(2026, 9, 20, 11, 10));
    expect(zonedToUtc('2026-10-20', '06:10', 'America/Phoenix')).toBe(Date.UTC(2026, 9, 20, 13, 10));
    // December: Chicago is CST (UTC-6).
    expect(zonedToUtc('2026-12-01', '06:10', 'America/Chicago')).toBe(Date.UTC(2026, 11, 1, 12, 10));
  });

  it('gives the local calendar date, not the UTC one', () => {
    const lateNight = zonedToUtc('2026-10-20', '23:30', 'America/Los_Angeles');
    expect(new Date(lateNight).toISOString().slice(0, 10)).toBe('2026-10-21');
    expect(localDate(lateNight, 'America/Los_Angeles')).toBe('2026-10-20');
  });

  it('reports zone offsets', () => {
    expect(tzOffsetMin(Date.UTC(2026, 9, 20, 12), 'America/New_York')).toBe(-240);
  });

  it('does date arithmetic across months', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(() => addDays('10/30/2026', 1)).toThrow(RangeError);
  });
});
