import { AIRPORTS, type Airport } from '@/engine';

import { distanceKm } from './leaveBy';

/** Airports the search can use, by code. Sample data until the schedule DB. */
export const SEARCH_AIRPORTS: readonly Airport[] = Object.values(AIRPORTS).sort((a, b) =>
  a.code.localeCompare(b.code),
);

/**
 * Picker filter: exact code first, then code prefix, then city/airport name
 * matches. Case-insensitive. Empty query returns everything.
 */
export function matchAirports(query: string, airports: readonly Airport[] = SEARCH_AIRPORTS): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...airports];
  const rank = (a: Airport) => {
    const code = a.code.toLowerCase();
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (a.name.toLowerCase().includes(q)) return 2;
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
 * Airport picker sections (design round 3). With no query: "Your airports"
 * (nearest first, then main home, then other homes) above "All airports".
 * A typed query shows one plain list of matches.
 */
export function pickerSections(
  query: string,
  quick: { nearest?: string | null; homes?: readonly { code: string; main: boolean }[] } = {},
  airports: readonly Airport[] = SEARCH_AIRPORTS,
): PickerSection[] {
  const matches = matchAirports(query, airports).map((airport) => ({ airport }));
  if (query.trim()) return [{ title: null, data: matches }];
  const byCode = new Map(airports.map((a) => [a.code, a]));
  const mine: PickerItem[] = [];
  const add = (code: string | null | undefined, tag: string) => {
    const airport = code ? byCode.get(code) : undefined;
    if (airport && !mine.some((m) => m.airport.code === airport.code)) mine.push({ airport, tag });
  };
  add(quick.nearest, 'Nearest');
  for (const h of quick.homes ?? []) add(h.code, h.main ? 'Main home' : 'Home');
  if (!mine.length) return [{ title: null, data: matches }];
  return [
    { title: 'Your airports', data: mine },
    { title: 'All airports', data: matches },
  ];
}
