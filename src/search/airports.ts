import { AIRPORTS, type Airport } from '@/engine';

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
