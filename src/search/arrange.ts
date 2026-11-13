/**
 * Itinerary preferences (Jayden, 2026-11-13): how the results list is ordered, and whether routes with a
 * canceled flight show. Both work on the routes the search found, after live status is known, so they
 * never start a new search.
 */
import type { Itinerary } from '@/engine';

import { departedFirst, type RowStatus } from './statusTags';

/** Departure is the default and today's order (John, 2026-10-30). */
export type SortBy = 'departure' | 'seats' | 'arrival';

export const SORT_BY: readonly SortBy[] = ['departure', 'seats', 'arrival'];

export interface ResultPrefs {
  sortBy: SortBy;
  /** Routes with a canceled flight show only when this is on (off by default). */
  showCanceled: boolean;
}

export const DEFAULT_RESULT_PREFS: ResultPrefs = { sortBy: 'departure', showCanceled: false };

/**
 * Seats on the route's fullest flight (fewest net seats), counting only reported and estimated loads.
 * Typical loads don't count (DECISIONS.md: they don't affect the Most seats sort). Null when no flight
 * on the route has a load to go by.
 */
export function routeSeats(it: Itinerary): number | null {
  let min: number | null = null;
  for (const { seats } of it.legs) {
    if ((seats.source !== 'reported' && seats.source !== 'estimate') || seats.netSeats == null) continue;
    if (min == null || seats.netSeats < min) min = seats.netSeats;
  }
  return min;
}

/** When the route gets in: the live arrival when status moved it, else the schedule. */
function arrivesAt(it: Itinerary, statuses?: Record<string, RowStatus>): number {
  return statuses?.[it.id]?.arrival?.newUtc ?? it.arriveUtc;
}

/**
 * The results in the order to show them, without routes that have a canceled flight unless
 * `showCanceled` is on. `keepId` (the open route) always stays, so it can't vanish while you look at it.
 *
 * - departure: today's order, routes that already left on top (departedFirst).
 * - seats: the route whose fullest flight has the most seats first; routes with no load to go by after.
 * - arrival: earliest arrival first, using the live arrival when status moved it.
 *
 * In the seats and arrival orders, routes that already left (live status, or the schedule says so) go
 * to the bottom: they can't be caught, so they shouldn't lead the list. Ties keep departure order.
 */
export function arrangeResults<T extends Itinerary>(
  results: T[],
  statuses: Record<string, RowStatus> | undefined,
  prefs: ResultPrefs,
  now: number,
  keepId?: string | null,
): T[] {
  const kept = prefs.showCanceled ? results : results.filter((it) => it.id === keepId || !statuses?.[it.id]?.canceled);
  if (prefs.sortBy === 'departure') return departedFirst(kept, statuses);
  const gone = (it: T) => !!statuses?.[it.id]?.dimmed || it.departUtc < now;
  const byDeparture = (a: T, b: T) => a.departUtc - b.departUtc || a.arriveUtc - b.arriveUtc;
  const compare =
    prefs.sortBy === 'seats'
      ? (a: T, b: T) => {
          const sa = routeSeats(a);
          const sb = routeSeats(b);
          if (sa == null || sb == null) return sa == null && sb == null ? 0 : sa == null ? 1 : -1;
          return sb - sa;
        }
      : (a: T, b: T) => arrivesAt(a, statuses) - arrivesAt(b, statuses) || a.stops - b.stops;
  return [...kept].sort((a, b) => Number(gone(a)) - Number(gone(b)) || compare(a, b) || byDeparture(a, b));
}

/** How many routes the canceled switch hid from `results` (the open route never counts). */
export function canceledHidden(
  results: readonly Itinerary[],
  statuses: Record<string, RowStatus> | undefined,
  prefs: ResultPrefs,
  keepId?: string | null,
): number {
  if (prefs.showCanceled) return 0;
  return results.filter((it) => it.id !== keepId && statuses?.[it.id]?.canceled).length;
}

/** The note over a list that isn't in departure order, so the order doesn't look wrong. */
export function sortNote(sortBy: SortBy): string | null {
  if (sortBy === 'seats') return 'Most seats first, on each route’s fullest flight.';
  if (sortBy === 'arrival') return 'Earliest arrival first.';
  return null;
}
