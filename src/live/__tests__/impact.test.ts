import { combineImpact, faaEventText, weatherRequestsForItinerary } from '../impact';
import type { AirportStatus } from '../airportStatus';
import type { StationWeather } from '../airportWeather';

const wx = (over: Partial<StationWeather> = {}): StationWeather => ({
  key: 'ORD:1:2',
  station: 'ORD',
  icao: 'KORD',
  windowStart: 1,
  windowEnd: 2,
  state: 'ok',
  level: 'none',
  reasons: [],
  observedAt: null,
  issuedAt: '2026-10-14T05:30:00.000Z',
  asOf: '2026-10-14T05:30:00.000Z',
  raw: null,
  stale: false,
  ...over,
});
const faa = (level: AirportStatus['level'], asOf = '2026-10-14T06:00:00.000Z') => ({
  status: {
    code: 'ORD',
    level,
    events: [{ type: level === 'likelyDelays' ? ('groundStop' as const) : ('delay' as const), reason: 'x', maxMinutes: 30 }],
  },
  asOf,
});

describe('combineImpact', () => {
  it('nothing -> none, no reasons', () => {
    expect(combineImpact(null, null)).toEqual({ level: 'none', reasons: [], asOf: null });
    expect(combineImpact({ status: null, asOf: 'x' }, wx())).toMatchObject({ level: 'none', reasons: [] });
  });
  it('worst wins: weather likelyDelays beats FAA caution', () => {
    const r = combineImpact(faa('caution'), wx({ level: 'likelyDelays', reasons: ['Thunderstorms'] }));
    expect(r.level).toBe('likelyDelays');
    expect(r.reasons.map((x) => [x.source, x.text])).toEqual([
      ['Weather', 'Thunderstorms'],
      ['FAA', 'Delays up to 30 min'],
    ]);
  });
  it('worst wins: FAA ground stop beats weather caution', () => {
    const r = combineImpact(faa('likelyDelays'), wx({ level: 'caution', reasons: ['Low clouds'] }));
    expect(r.level).toBe('likelyDelays');
    expect(r.reasons[0]).toMatchObject({ source: 'FAA', text: 'Ground stop' });
  });
  it('asOf is the oldest input', () => {
    expect(combineImpact(faa('caution', '2026-10-14T06:00:00.000Z'), wx({ level: 'caution', reasons: ['a'] })).asOf).toBe(
      '2026-10-14T05:30:00.000Z',
    );
    expect(combineImpact(faa('caution', '2026-10-14T04:00:00.000Z'), wx({ level: 'caution', reasons: ['a'] })).asOf).toBe(
      '2026-10-14T04:00:00.000Z',
    );
  });
  it('noForecast / noData weather contributes nothing, FAA still shows', () => {
    for (const state of ['noForecast', 'noData'] as const) {
      const r = combineImpact(faa('caution'), wx({ state, asOf: null }));
      expect(r.level).toBe('caution');
      expect(r.reasons.every((x) => x.source === 'FAA')).toBe(true);
      expect(r.asOf).toBe('2026-10-14T06:00:00.000Z');
    }
  });
  it('event text', () => {
    expect(faaEventText({ type: 'closure', reason: '' })).toBe('Airport closed');
    expect(faaEventText({ type: 'groundDelay', reason: '' })).toBe('Ground delay program');
    expect(faaEventText({ type: 'delay', reason: '' })).toBe('Delays');
  });
});

describe('weatherRequestsForItinerary', () => {
  const leg = (from: string, to: string, departUtc: number, arriveUtc: number) => ({ flight: { from, to, departUtc, arriveUtc } });
  const H = 3_600_000;
  it('nonstop -> destination only, arrival +/- 1h; origin never evaluated', () => {
    const it = { legs: [leg('BNA', 'LAX', 0, 4 * H)] } as unknown as Parameters<typeof weatherRequestsForItinerary>[0];
    expect(weatherRequestsForItinerary(it)).toEqual([{ station: 'LAX', fromMs: 3 * H, toMs: 5 * H }]);
  });
  it('connection -> landing to next departure, then destination', () => {
    const it = {
      legs: [leg('BNA', 'DFW', 0, 2 * H), leg('DFW', 'LAX', 4 * H, 7 * H)],
    } as unknown as Parameters<typeof weatherRequestsForItinerary>[0];
    expect(weatherRequestsForItinerary(it, H / 2)).toEqual([
      { station: 'DFW', fromMs: 2 * H, toMs: 4 * H },
      { station: 'LAX', fromMs: 6.5 * H, toMs: 7.5 * H },
    ]);
  });
});
