import type { Airport } from './types';

/**
 * Sample airport table (30 airports since round 224). The real list arrives with the
 * schedule DB. Coordinates are airport reference points, rounded.
 */
export const AIRPORTS: Record<string, Airport> = Object.fromEntries(
  (
    [
      ['ATL', 'Atlanta', -84.4277, 33.6407, 'America/New_York', 'Atlanta', 'GA', 'US', 'Hartsfield-Jackson'],
      ['BNA', 'Nashville', -86.6774, 36.1263, 'America/Chicago', 'Nashville', 'TN', 'US', 'Nashville International'],
      ['CLT', 'Charlotte', -80.9431, 35.214, 'America/New_York', 'Charlotte', 'NC', 'US', 'Charlotte Douglas'],
      ['DAL', 'Dallas Love Field', -96.8518, 32.8471, 'America/Chicago', 'Dallas', 'TX', 'US', 'Love Field'],
      ['DEN', 'Denver', -104.6737, 39.8561, 'America/Denver', 'Denver', 'CO', 'US', 'Denver International'],
      ['DFW', 'Dallas/Fort Worth', -97.0403, 32.8998, 'America/Chicago', 'Dallas', 'TX', 'US', 'DFW International'],
      ['LAX', 'Los Angeles', -118.4085, 33.9416, 'America/Los_Angeles', 'Los Angeles', 'CA', 'US', 'Los Angeles International'],
      ['LGA', 'New York LaGuardia', -73.874, 40.7769, 'America/New_York', 'New York', 'NY', 'US', 'LaGuardia'],
      ['MIA', 'Miami', -80.287, 25.7959, 'America/New_York', 'Miami', 'FL', 'US', 'Miami International'],
      ['ORD', "Chicago O'Hare", -87.9073, 41.9742, 'America/Chicago', 'Chicago', 'IL', 'US', "O'Hare"],
      ['PHX', 'Phoenix', -112.0116, 33.4342, 'America/Phoenix', 'Phoenix', 'AZ', 'US', 'Sky Harbor'],
      ['SEA', 'Seattle', -122.3088, 47.4502, 'America/Los_Angeles', 'Seattle', 'WA', 'US', 'Seattle-Tacoma'],
      // Round 224 (John: browse by country, state and city, "especially for international"): more US airports
      // so states and cities have choices, and a few abroad so countries do. Sample data like the rest.
      ['AUS', 'Austin', -97.6699, 30.1945, 'America/Chicago', 'Austin', 'TX', 'US', 'Austin-Bergstrom'],
      ['IAH', 'Houston Bush', -95.3414, 29.9902, 'America/Chicago', 'Houston', 'TX', 'US', 'George Bush Intercontinental'],
      ['HOU', 'Houston Hobby', -95.2789, 29.6454, 'America/Chicago', 'Houston', 'TX', 'US', 'Hobby'],
      ['JFK', 'New York JFK', -73.7781, 40.6413, 'America/New_York', 'New York', 'NY', 'US', 'John F. Kennedy International'],
      ['MDW', 'Chicago Midway', -87.7524, 41.7868, 'America/Chicago', 'Chicago', 'IL', 'US', 'Midway'],
      [
        'SFO',
        'San Francisco',
        -122.379,
        37.6213,
        'America/Los_Angeles',
        'San Francisco',
        'CA',
        'US',
        'San Francisco International',
      ],
      ['MCO', 'Orlando', -81.3081, 28.4312, 'America/New_York', 'Orlando', 'FL', 'US', 'Orlando International'],
      [
        'FLL',
        'Fort Lauderdale',
        -80.1527,
        26.0742,
        'America/New_York',
        'Fort Lauderdale',
        'FL',
        'US',
        'Fort Lauderdale-Hollywood',
      ],
      ['YYZ', 'Toronto', -79.6248, 43.6777, 'America/Toronto', 'Toronto', 'ON', 'CA', 'Pearson'],
      ['YVR', 'Vancouver', -123.1815, 49.1947, 'America/Vancouver', 'Vancouver', 'BC', 'CA', 'Vancouver International'],
      ['CUN', 'Cancún', -86.8771, 21.0365, 'America/Cancun', 'Cancún', 'ROO', 'MX', 'Cancún International'],
      ['MEX', 'Mexico City', -99.0721, 19.4361, 'America/Mexico_City', 'Mexico City', 'CMX', 'MX', 'Benito Juárez International'],
      ['LHR', 'London Heathrow', -0.4543, 51.47, 'Europe/London', 'London', 'ENG', 'GB', 'Heathrow'],
      ['LGW', 'London Gatwick', -0.1821, 51.1537, 'Europe/London', 'London', 'ENG', 'GB', 'Gatwick'],
      ['MAD', 'Madrid', -3.5676, 40.4983, 'Europe/Madrid', 'Madrid', 'MD', 'ES', 'Adolfo Suárez Madrid-Barajas'],
      ['BCN', 'Barcelona', 2.0785, 41.2974, 'Europe/Madrid', 'Barcelona', 'CT', 'ES', 'Josep Tarradellas Barcelona-El Prat'],
      ['HND', 'Tokyo Haneda', 139.7798, 35.5494, 'Asia/Tokyo', 'Tokyo', '13', 'JP', 'Haneda'],
      ['NRT', 'Tokyo Narita', 140.3929, 35.772, 'Asia/Tokyo', 'Tokyo', '12', 'JP', 'Narita'],
    ] as const
  ).map(([code, name, lon, lat, tz, city, region, country, airportName]) => [
    code,
    { code, name, lon, lat, tz, city, region, country, airportName },
  ]),
);

/**
 * The round 224 airports are sample data only: the daily live schedule pull (scheduleConfig.ts) costs money per
 * airport and still covers just the first twelve, so with live schedules on the picker hides these.
 */
export const SAMPLE_ONLY_AIRPORTS: ReadonlySet<string> = new Set([
  'AUS',
  'IAH',
  'HOU',
  'JFK',
  'MDW',
  'SFO',
  'MCO',
  'FLL',
  'YYZ',
  'YVR',
  'CUN',
  'MEX',
  'LHR',
  'LGW',
  'MAD',
  'BCN',
  'HND',
  'NRT',
]);

/**
 * Where an airport is, the way a person says it: "Dallas, TX" in the US, and city plus country code
 * elsewhere ("London, GB"). Falls back to the code when the table doesn't know the city (round 132,
 * John: the home pin "should also say the city, state or city, country abbreviation").
 */
export function placeLabel(code: string, airports: Readonly<Record<string, Airport>> = AIRPORTS): string {
  const a = airports[code];
  if (!a?.city) return code;
  const tail = !a.country || a.country === 'US' ? a.region : a.country;
  return tail ? `${a.city}, ${tail}` : a.city;
}

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
