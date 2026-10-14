import type { Airport } from './types';

/**
 * Sample airport table. The real list (~30 airports) arrives with the
 * schedule DB. Coordinates are airport reference points, rounded.
 */
export const AIRPORTS: Record<string, Airport> = Object.fromEntries(
  (
    [
      ['ATL', 'Atlanta', -84.4277, 33.6407, 'America/New_York'],
      ['BNA', 'Nashville', -86.6774, 36.1263, 'America/Chicago'],
      ['CLT', 'Charlotte', -80.9431, 35.214, 'America/New_York'],
      ['DAL', 'Dallas Love Field', -96.8518, 32.8471, 'America/Chicago'],
      ['DEN', 'Denver', -104.6737, 39.8561, 'America/Denver'],
      ['DFW', 'Dallas/Fort Worth', -97.0403, 32.8998, 'America/Chicago'],
      ['LAX', 'Los Angeles', -118.4085, 33.9416, 'America/Los_Angeles'],
      ['LGA', 'New York LaGuardia', -73.874, 40.7769, 'America/New_York'],
      ['MIA', 'Miami', -80.287, 25.7959, 'America/New_York'],
      ['ORD', "Chicago O'Hare", -87.9073, 41.9742, 'America/Chicago'],
      ['PHX', 'Phoenix', -112.0116, 33.4342, 'America/Phoenix'],
      ['SEA', 'Seattle', -122.3088, 47.4502, 'America/Los_Angeles'],
    ] as const
  ).map(([code, name, lon, lat, tz]) => [code, { code, name, lon, lat, tz }]),
);

export interface NearbyGroup {
  airports: readonly string[];
  /** Ground transfer between any two airports in the group, minutes. */
  transferMin: number;
}

/**
 * Nearby airport groups. DECISIONS.md confirms DAL<->DFW only; other metros
 * and all transfer times are pending John (Q-012). 35 min is provisional.
 */
export const NEARBY_GROUPS: readonly NearbyGroup[] = [{ airports: ['DAL', 'DFW'], transferMin: 35 }];

/**
 * The requested airport (transfer 0) plus nearby airports within
 * `maxTransferMin`, as [code, transferMin] pairs.
 */
export function airportsNear(
  code: string,
  maxTransferMin: number,
  groups: readonly NearbyGroup[] = NEARBY_GROUPS,
): [string, number][] {
  const out: [string, number][] = [[code, 0]];
  for (const g of groups) {
    if (!g.airports.includes(code) || g.transferMin > maxTransferMin) continue;
    for (const other of g.airports) if (other !== code) out.push([other, g.transferMin]);
  }
  return out;
}
