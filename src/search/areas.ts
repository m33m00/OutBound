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
