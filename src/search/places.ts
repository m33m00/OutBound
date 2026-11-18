/**
 * Countries, states and cities for the airport picker (round 224, John: "Can you great a hierarchy/grouping
 * depending on what country you want to depart out of, what state you want to depart out of, and what city you
 * want to depart of and include those options of airports in the search? Sometimes we don't even know what
 * options exist when we want to go to an international destination").
 *
 * The tree is built from whatever airports the picker offers, so it never shows an empty place:
 * country, then state (the US and Canada only, where people think in states and provinces), then city,
 * then airports. A level with only one place in it is skipped (Illinois goes straight to O'Hare and Midway),
 * and a place with one airport is that airport.
 */
import { geoInterpolate } from 'd3-geo';

import { AIRPORTS, type Airport, type PlaceRef } from '@/engine';

import { plainWords, startsAWord } from './airports';

export type PlaceKind = 'country' | 'region' | 'city';

export interface PlaceNode {
  key: string;
  kind: PlaceKind;
  /** "United States", "Texas", "Dallas". */
  name: string;
  /** Every airport inside, A to Z. */
  airports: string[];
  /** What's one level down: smaller places, or the airports themselves. */
  children: PlaceChild[];
  /** Up one level, for the back row; null at the top. */
  parent: string | null;
}

export type PlaceChild = { place: PlaceNode } | { airport: Airport };

/** Country names people use, by ISO code. Anything missing shows its code. */
export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  GB: 'United Kingdom',
  ES: 'Spain',
  JP: 'Japan',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  NL: 'Netherlands',
  IE: 'Ireland',
  PT: 'Portugal',
  CH: 'Switzerland',
  AT: 'Austria',
  BE: 'Belgium',
  DK: 'Denmark',
  SE: 'Sweden',
  NO: 'Norway',
  FI: 'Finland',
  IS: 'Iceland',
  GR: 'Greece',
  TR: 'Türkiye',
  AE: 'United Arab Emirates',
  QA: 'Qatar',
  IL: 'Israel',
  IN: 'India',
  CN: 'China',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  KR: 'South Korea',
  SG: 'Singapore',
  TH: 'Thailand',
  PH: 'Philippines',
  AU: 'Australia',
  NZ: 'New Zealand',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  CR: 'Costa Rica',
  PA: 'Panama',
  DO: 'Dominican Republic',
  JM: 'Jamaica',
  BS: 'Bahamas',
  PR: 'Puerto Rico',
};

/** States and provinces, for the countries that get a state level. */
const REGION_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  US: {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    DC: 'Washington, D.C.',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
  },
  CA: {
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
  },
};

export const countryName = (code: string): string => COUNTRY_NAMES[code] ?? code;

const WITH_THE = new Set([
  'United States',
  'United Kingdom',
  'Netherlands',
  'Bahamas',
  'Dominican Republic',
  'Philippines',
  'United Arab Emirates',
]);

/** A place inside a sentence: "the United States", "Spain", "Texas". */
export const inPlace = (name: string): string => (WITH_THE.has(name) ? `the ${name}` : name);

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const childName = (c: PlaceChild) => ('place' in c ? c.place.name : (c.airport.city ?? c.airport.name));

function node(key: string, kind: PlaceKind, name: string, parent: string | null, children: PlaceChild[]): PlaceNode {
  // A level with one place in it says nothing: show what's inside that place instead.
  let kids = children;
  while (kids.length === 1 && 'place' in kids[0]) kids = kids[0].place.children;
  kids = [...kids].sort((a, b) => childName(a).localeCompare(childName(b)) || codeOf(a).localeCompare(codeOf(b)));
  for (const k of kids) if ('place' in k) k.place.parent = key;
  const airports = kids.flatMap((k) => ('place' in k ? k.place.airports : [k.airport.code])).sort();
  return { key, kind, name, airports, children: kids, parent };
}

const codeOf = (c: PlaceChild) => ('place' in c ? c.place.key : c.airport.code);

function groupBy<T>(items: readonly T[], keyOf: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) {
    const k = keyOf(t);
    out.set(k, [...(out.get(k) ?? []), t]);
  }
  return out;
}

/** One city's airports: a place when it has two or more, else just the airport. */
function cityChild(prefix: string, city: string, airports: Airport[], parent: string): PlaceChild {
  if (airports.length === 1) return { airport: airports[0] };
  const kids = [...airports].sort((a, b) => a.code.localeCompare(b.code)).map((airport) => ({ airport }));
  return { place: node(`city:${prefix}-${city}`, 'city', city, parent, kids) };
}

function citiesOf(prefix: string, airports: Airport[], parent: string): PlaceChild[] {
  return [...groupBy(airports, (a) => a.city ?? a.name)].map(([city, list]) => cityChild(prefix, city, list, parent));
}

/**
 * The picker's place tree for these airports, countries first: `first` (your home country) leads, then A to Z
 * by name.
 */
export function placeTree(airports: readonly Airport[], first = 'US'): PlaceNode[] {
  const countries = [...groupBy(airports, (a) => a.country ?? 'US')].map(([cc, list]) => {
    const key = `country:${cc}`;
    const regions = REGION_NAMES[cc];
    const children: PlaceChild[] = regions
      ? [...groupBy(list, (a) => a.region ?? '')].map(([rc, inRegion]) => {
          const rKey = `region:${cc}-${rc}`;
          const cities = citiesOf(`${cc}-${rc}`, inRegion, rKey);
          return { place: node(rKey, 'region', regions[rc] ?? rc, key, cities) };
        })
      : citiesOf(cc, list, key);
    return node(key, 'country', countryName(cc), null, children);
  });
  return countries.sort((a, b) => (a.key === `country:${first}` ? -1 : b.key === `country:${first}` ? 1 : byName(a, b)));
}

/** Every place in the tree, top down. */
export function allPlaces(tree: readonly PlaceNode[]): PlaceNode[] {
  return tree.flatMap((p) => [p, ...allPlaces(p.children.flatMap((c) => ('place' in c ? [c.place] : [])))]);
}

export function findPlace(tree: readonly PlaceNode[], key: string | null | undefined): PlaceNode | null {
  if (!key) return null;
  return allPlaces(tree).find((p) => p.key === key) ?? null;
}

/** What a search and the From/To card need to know about a picked place. */
export function placeRef(p: PlaceNode): PlaceRef {
  return { key: p.key, name: p.name, airports: p.airports };
}

/** Places whose name starts with what's typed ("spa", "tex", "new york"), countries first. */
export function matchPlaces(tree: readonly PlaceNode[], query: string): PlaceNode[] {
  const q = plainWords(query);
  if (!q) return [];
  const rank: Record<PlaceKind, number> = { country: 0, region: 1, city: 2 };
  return allPlaces(tree)
    .filter((p) => startsAWord(p.name, q) || (p.kind === 'country' && p.key === `country:${q.toUpperCase()}`))
    .sort((a, b) => rank[a.kind] - rank[b.kind] || byName(a, b));
}

/** The short list of codes under a place's name, or a count once it gets long: "MAD, BCN", "21 airports". */
export function placeCodes(airports: readonly string[], max = 4): string {
  return airports.length <= max ? airports.join(', ') : `${airports.length} airports`;
}

/** The middle of some airports, plainly averaged (fine for any one country or state). */
function middle(codes: readonly string[]): [number, number] | null {
  const known = codes.map((c) => AIRPORTS[c]).filter(Boolean);
  if (!known.length) return null;
  return [known.reduce((s, a) => s + a.lon, 0) / known.length, known.reduce((s, a) => s + a.lat, 0) / known.length];
}

/**
 * Where the globe rests once a place is picked (round 224): halfway along the great circle between the middles
 * of the two sides, so "United States to Madrid" shows both ends; just the place's middle while To is empty.
 */
export function restBetween(from: readonly string[], to: readonly string[]): [number, number] {
  const a = middle(from);
  const b = middle(to);
  if (a && b) {
    const m = geoInterpolate([a[0], a[1]], [b[0], b[1]])(0.5);
    return [m[0], m[1]];
  }
  return a ?? b ?? [-98, 38];
}
