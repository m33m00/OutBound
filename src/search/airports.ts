import { AIRPORTS, SAMPLE_ONLY_AIRPORTS, type Airport } from '@/engine';
import { readScheduleSource } from '@/live/schedules';

import { distanceKm } from './leaveBy';

/** Airports the search can use, by code. Sample data until the schedule DB. */
export const SEARCH_AIRPORTS: readonly Airport[] = searchAirports(readScheduleSource() === 'live');

/** Every airport, A to Z; with live schedules on, only those the live pull covers (round 224). */
export function searchAirports(live: boolean): Airport[] {
  return Object.values(AIRPORTS)
    .filter((a) => !live || !SAMPLE_ONLY_AIRPORTS.has(a.code))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Lower case, accents dropped, anything but letters and digits made a space: "Cancún" reads "cancun". */
export function plainWords(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether `q` (already plain) starts one of the words in `text`, so "dal" finds Dallas but not
 * Fort Lauderdale (round 224). A query of several words works the same way ("fort w").
 */
export function startsAWord(text: string, q: string): boolean {
  const t = plainWords(text);
  return t.startsWith(q) || t.includes(` ${q}`);
}

/**
 * Picker filter: exact code first, then code prefix, then city/airport name
 * matches. Case-insensitive. Empty query returns everything.
 */
export function matchAirports(query: string, airports: readonly Airport[] = SEARCH_AIRPORTS): Airport[] {
  const q = plainWords(query);
  if (!q) return [...airports];
  const rank = (a: Airport) => {
    const code = a.code.toLowerCase();
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (startsAWord(a.name, q) || (a.airportName && startsAWord(a.airportName, q))) return 2;
    // A city or state works too, as the search box says ("Dallas", "TX"; round 163).
    if ((a.city && startsAWord(a.city, q)) || a.region?.toLowerCase() === q) return 3;
    return -1;
  };
  return airports
    .map((a) => [a, rank(a)] as const)
    .filter(([, r]) => r >= 0)
    .sort((x, y) => x[1] - y[1] || x[0].code.localeCompare(y[0].code))
    .map(([a]) => a);
}

/** Closest airport in the app's data, however far (Q-051). Null only for an empty list. */
export function nearestAirport(lat: number, lon: number, airports: readonly Airport[] = SEARCH_AIRPORTS): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const a of airports) {
    const km = distanceKm(lat, lon, a.lat, a.lon);
    if (km < bestKm) {
      best = a.code;
      bestKm = km;
    }
  }
  return best;
}

export interface PickerItem {
  airport: Airport;
  /** Why it's in the quick list: "Nearest", "Main home", "Home". */
  tag?: string;
}

export interface PickerSection {
  /** Null = no heading (a typed search). */
  title: string | null;
  data: PickerItem[];
}

/**
 * Airport picker sections (design round 3). With no query: "Your airports" (nearest first, then main home,
 * then other homes), then "Recent" (your last picks, round 214), then "All airports", always with its heading
 * so the list says what it is (round 214, John: "Fix all of them"). A typed query shows one plain list of
 * matches.
 */
export function pickerSections(
  query: string,
  quick: {
    nearest?: string | null;
    homes?: readonly { code: string; main: boolean }[];
    /** Your last picks, newest first (round 214). */
    recent?: readonly string[];
    /** Codes left out everywhere: the other end's whole area (round 138, John: no Dallas to Dallas). */
    exclude?: readonly string[];
  } = {},
  all: readonly Airport[] = SEARCH_AIRPORTS,
): PickerSection[] {
  const airports = quick.exclude?.length ? all.filter((a) => !quick.exclude!.includes(a.code)) : all;
  const matches = matchAirports(query, airports).map((airport) => ({ airport }));
  if (query.trim()) return [{ title: null, data: matches }];
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const mine: PickerItem[] = [];
  const add = (list: PickerItem[], code: string | null | undefined, tag?: string) => {
    const airport = code ? byCode.get(code) : undefined;
    const taken = [...mine, ...list].some((m) => m.airport.code === airport?.code);
    if (airport && !taken) list.push(tag ? { airport, tag } : { airport });
  };
  add(mine, quick.nearest, 'Nearest');
  for (const h of quick.homes ?? []) add(mine, h.code, h.main ? 'Main home' : 'Home');
  const recent: PickerItem[] = [];
  for (const code of quick.recent ?? []) add(recent, code);
  return [
    ...(mine.length ? [{ title: 'Your airports', data: mine }] : []),
    ...(recent.length ? [{ title: 'Recent', data: recent }] : []),
    { title: 'All airports', data: matches },
  ];
}
