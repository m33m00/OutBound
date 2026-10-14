import { legSeats, routeTier, tierForNetSeats, tierRank } from '../seats';
import type { LegSeats } from '../types';

describe('tierForNetSeats (DECISIONS.md boundaries)', () => {
  it.each([
    [200, 'wide'],
    [50, 'wide'],
    [49, 'good'],
    [15, 'good'],
    [14, 'okay'],
    [6, 'okay'],
    [5, 'tight'],
    [1, 'tight'],
    [0, 'full'],
    [-8, 'full'],
  ] as const)('%i net seats -> %s', (net, tier) => {
    expect(tierForNetSeats(net)).toBe(tier);
  });
});

describe('legSeats', () => {
  const r = (source: 'reported' | 'estimate' | 'typical', open: number, listed: number, asOf = 0) => ({
    source,
    openSeats: open,
    listed,
    asOf,
  });

  it('is unknown with no data', () => {
    expect(legSeats([])).toEqual({ source: 'unknown', tier: 'unknown', netSeats: null, asOf: null });
  });

  it('uses net seats = open - listed', () => {
    expect(legSeats([r('reported', 20, 6)])).toMatchObject({ netSeats: 14, tier: 'okay' });
  });

  it('prefers crowd report > estimate > typical regardless of order', () => {
    const list = [r('typical', 100, 0), r('estimate', 60, 0), r('reported', 3, 0)];
    expect(legSeats(list)).toMatchObject({ source: 'reported', tier: 'tight' });
    expect(legSeats(list.slice(0, 2))).toMatchObject({ source: 'estimate', tier: 'wide' });
  });

  it('takes the newest reading within a source', () => {
    expect(legSeats([r('reported', 2, 0, 100), r('reported', 30, 0, 200)])).toMatchObject({
      netSeats: 30,
      asOf: 200,
    });
  });

  it('keeps typical loads neutral (tier unknown, source typical)', () => {
    expect(legSeats([r('typical', 80, 0, 5)])).toEqual({
      source: 'typical',
      tier: 'unknown',
      netSeats: 80,
      asOf: 5,
    });
  });
});

describe('routeTier = weakest leg', () => {
  const leg = (tier: LegSeats['tier'], source: LegSeats['source'] = 'reported'): LegSeats => ({
    source,
    tier,
    netSeats: null,
    asOf: null,
  });

  it('picks the weakest known leg', () => {
    expect(routeTier([leg('wide'), leg('tight'), leg('good')])).toBe('tight');
    expect(routeTier([leg('good'), leg('full')])).toBe('full');
  });

  it('ignores unknown and typical legs', () => {
    expect(routeTier([leg('unknown', 'typical'), leg('good'), leg('unknown', 'unknown')])).toBe('good');
    expect(routeTier([leg('unknown', 'typical'), leg('unknown', 'unknown')])).toBe('unknown');
  });

  it('ranks wide best and unknown last', () => {
    const order = ['wide', 'good', 'okay', 'tight', 'full', 'unknown'] as const;
    expect(order.map(tierRank)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
