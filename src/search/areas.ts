import type { SearchRequest } from '@/engine';

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
): SearchRequest {
  return {
    origin,
    destination,
    date,
    originArea: !!areaOn[origin],
    destinationArea: wholeToArea ?? !!areaOn[destination],
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
