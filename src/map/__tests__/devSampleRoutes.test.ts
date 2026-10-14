import { devSampleRoutes } from '../devSampleRoutes';

describe('devSampleRoutes', () => {
  it('has unique route and leg ids and valid coordinates', () => {
    const ids = devSampleRoutes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const legIds = devSampleRoutes.flatMap((r) => r.legs.map((l) => l.id));
    expect(new Set(legIds).size).toBe(legIds.length);
    for (const l of devSampleRoutes.flatMap((r) => r.legs)) {
      for (const p of [l.from, l.to]) {
        expect(Math.abs(p[0])).toBeLessThanOrEqual(180);
        expect(Math.abs(p[1])).toBeLessThanOrEqual(90);
      }
    }
  });

  it('typical and unknown sources carry tier unknown (engine mapping)', () => {
    for (const l of devSampleRoutes.flatMap((r) => r.legs)) {
      if (l.source === 'typical' || l.source === 'unknown') expect(l.tier).toBe('unknown');
    }
  });

  it('covers every source and more than 10 routes', () => {
    const sources = new Set(devSampleRoutes.flatMap((r) => r.legs.map((l) => l.source)));
    expect([...sources].sort()).toEqual(['estimate', 'reported', 'typical', 'unknown']);
    expect(devSampleRoutes.length).toBeGreaterThan(10);
  });
});
