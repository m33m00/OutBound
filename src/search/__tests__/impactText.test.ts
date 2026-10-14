import type { RouteImpact } from '@/live';

import { badgedStations, impactAge, impactSummary } from '../impactText';

const NOW = Date.UTC(2026, 9, 20, 12);
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const impact: RouteImpact = {
  level: 'likelyDelays',
  asOf: iso(12),
  stale: false,
  stations: [
    { code: 'LAX', role: 'destination', level: 'caution', reasons: [{ source: 'Weather', text: 'Gusts 32 kt', level: 'caution' }], asOf: iso(5), stale: false, noForecast: false },
    { code: 'DEN', role: 'connection', level: 'none', reasons: [], asOf: null, stale: false, noForecast: true },
    {
      code: 'ORD',
      role: 'connection',
      level: 'likelyDelays',
      reasons: [
        { source: 'FAA', text: 'Ground stop', level: 'likelyDelays' },
        { source: 'Weather', text: 'Thunderstorms', level: 'likelyDelays' },
      ],
      asOf: iso(12),
      stale: false,
      noForecast: false,
    },
  ],
};

describe('impact text', () => {
  it('lists badged stations worst first', () => {
    expect(badgedStations(impact).map((s) => s.code)).toEqual(['ORD', 'LAX']);
  });

  it('summarizes for VoiceOver with age', () => {
    expect(impactSummary(impact, NOW)).toBe(
      'Likely delays at ORD: Ground stop, Thunderstorms. Caution at LAX: Gusts 32 kt. Updated 12m ago.',
    );
    expect(impactSummary({ ...impact, stale: true }, NOW)).toContain('may be out of date');
    expect(impactSummary({ ...impact, level: 'none' }, NOW)).toBe('');
  });

  it('always shows the age on the row when known', () => {
    expect(impactAge(impact, NOW)).toBe('12m ago');
    expect(impactAge({ asOf: iso(0) }, NOW)).toBe('just now');
    expect(impactAge({ asOf: null }, NOW)).toBe('');
  });
});
