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

/**
 * Airport areas (Q-048): IATA metropolitan city groupings as major airlines
 * use them. Primary airport first; the card lists them in this order.
 * Only airports in the app's data count, and an area needs 2+ of them, so
 * most rows stay dormant until their airports are added (today: Dallas).
 * Groupings marked "unsure" have no single official IATA metro code; they
 * follow how airline booking sites group the city.
 */
export const AREA_TABLE: readonly { city: string; airports: readonly string[] }[] = [
  // United States
  { city: 'Dallas', airports: ['DAL', 'DFW'] }, // IATA DFW; order per DECISIONS.md example
  { city: 'Houston', airports: ['IAH', 'HOU'] }, // IATA HOU
  { city: 'Chicago', airports: ['ORD', 'MDW'] }, // IATA CHI
  { city: 'New York', airports: ['JFK', 'LGA', 'EWR'] }, // IATA NYC
  { city: 'Washington', airports: ['IAD', 'DCA', 'BWI'] }, // IATA WAS
  { city: 'Los Angeles', airports: ['LAX', 'BUR', 'LGB', 'SNA', 'ONT'] }, // unsure: no IATA metro code
  { city: 'Bay Area', airports: ['SFO', 'OAK', 'SJC'] }, // unsure: no IATA metro code
  { city: 'Miami', airports: ['MIA', 'FLL'] }, // unsure: some airlines add PBI
  { city: 'Orlando', airports: ['MCO', 'SFB'] }, // unsure: IATA ORL; SFB inclusion varies
  // Canada and Latin America
  { city: 'Toronto', airports: ['YYZ', 'YTZ'] }, // IATA YTO
  { city: 'Mexico City', airports: ['MEX', 'NLU'] }, // unsure: NLU grouping varies
  { city: 'São Paulo', airports: ['GRU', 'CGH', 'VCP'] }, // IATA SAO
  { city: 'Rio de Janeiro', airports: ['GIG', 'SDU'] }, // IATA RIO
  { city: 'Buenos Aires', airports: ['EZE', 'AEP'] }, // IATA BUE
  // Europe
  { city: 'London', airports: ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'SEN'] }, // IATA LON
  { city: 'Paris', airports: ['CDG', 'ORY'] }, // IATA PAR (BVA unsure, left out)
  { city: 'Milan', airports: ['MXP', 'LIN', 'BGY'] }, // IATA MIL
  { city: 'Rome', airports: ['FCO', 'CIA'] }, // IATA ROM
  { city: 'Stockholm', airports: ['ARN', 'BMA'] }, // IATA STO
  { city: 'Istanbul', airports: ['IST', 'SAW'] }, // unsure: IATA IST city code
  // Asia
  { city: 'Tokyo', airports: ['HND', 'NRT'] }, // IATA TYO
  { city: 'Osaka', airports: ['KIX', 'ITM'] }, // IATA OSA
  { city: 'Seoul', airports: ['ICN', 'GMP'] }, // IATA SEL
  { city: 'Shanghai', airports: ['PVG', 'SHA'] }, // IATA SHA
  { city: 'Beijing', airports: ['PEK', 'PKX'] }, // IATA BJS
  { city: 'Taipei', airports: ['TPE', 'TSA'] }, // IATA TPE
  { city: 'Bangkok', airports: ['BKK', 'DMK'] }, // IATA BKK
];

/**
 * Ground transfer between two area airports, minutes, keyed "AAA-BBB" in
 * alphabetical order. Internal data for the "Leaves from DAL, 35 min from
 * DFW" notes. 35 is provisional (Q-012/Q-052); pairs not listed are unknown.
 */
const TRANSFER_MIN: Record<string, number> = { 'DAL-DFW': 35 };

export interface Area {
  city: string;
  /** Airports in the app's data, table order. Always 2+. */
  airports: string[];
}

/** The area `code` belongs to, counting only airports in `known`; null if under 2. */
export function areaFor(code: string, known: Readonly<Record<string, unknown>> = AIRPORTS): Area | null {
  const row = AREA_TABLE.find((a) => a.airports.includes(code));
  if (!row || !(code in known)) return null;
  const airports = row.airports.filter((c) => c in known);
  return airports.length >= 2 ? { city: row.city, airports } : null;
}

/** Ground transfer minutes between two airports: 0 for the same one, null if unknown. */
export function transferMin(a: string, b: string): number | null {
  if (a === b) return 0;
  return TRANSFER_MIN[a < b ? `${a}-${b}` : `${b}-${a}`] ?? null;
}

/**
 * One end of a search as [code, transferMin] pairs: the requested airport
 * (transfer 0) first, plus the rest of its area when `wholeArea` is on.
 */
export function endAirports(code: string, wholeArea: boolean): [string, number | null][] {
  const out: [string, number | null][] = [[code, 0]];
  if (!wholeArea) return out;
  for (const other of areaFor(code)?.airports ?? []) {
    if (other !== code) out.push([other, transferMin(code, other)]);
  }
  return out;
}
