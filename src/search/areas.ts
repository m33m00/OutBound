import { areaFor, type PlaceRef, type SearchRequest } from '@/engine';

/**
 * Search request from the cards (Q-048): each end uses its remembered area
 * toggle, off unless set. `wholeToArea` overrides the To toggle: Get Home
 * passes true so it always searches every airport in the home's area.
 */
export function searchRequest(
  origin: string,
  destination: string,
  date: string,
  areaOn: Readonly<Record<string, boolean>>,
  wholeToArea?: boolean,
  groups: { origin?: PlaceRef | null; destination?: PlaceRef | null } = {},
): SearchRequest {
  // A whole country, state or city (round 224) already holds every airport it means, so no area toggle.
  return {
    origin,
    destination,
    date,
    originArea: groups.origin ? false : !!areaOn[origin],
    destinationArea: groups.destination ? false : (wholeToArea ?? !!areaOn[destination]),
    ...(groups.origin ? { originGroup: groups.origin } : {}),
    ...(groups.destination ? { destinationGroup: groups.destination } : {}),
  };
}

/**
 * Get Home shows away from every home (Q-026), and not once To is already a home: then Find
 * Routes goes to the same place and two main buttons were confusing (John, 2026-11-01).
 * `homes` is the full home list, area airports included.
 */
export function showGetHome(homes: readonly { code: string }[], origin: string | null, destination: string | null): boolean {
  const isHome = (code: string | null) => code != null && homes.some((h) => h.code === code);
  return homes.length > 0 && origin != null && !isHome(origin) && !isHome(destination);
}

/**
 * Airports the other end's picker leaves out (round 138, John): the picked airport and every airport in its
 * area, both ways, so Dallas as From means neither DAL nor DFW is offered as To (and the other way round).
 */
export function otherEndExcludes(code: string | null | undefined, group?: PlaceRef | null): string[] {
  // A picked place leaves out each of its airports and their areas (round 224).
  if (group) return [...new Set(group.airports.flatMap((a) => otherEndExcludes(a)))];
  if (!code) return [];
  return areaFor(code)?.airports.slice() ?? [code];
}
