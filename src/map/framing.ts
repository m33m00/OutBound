/**
 * What the map frames by itself when the screen passes no `cameraTarget`
 * (pure). DECISIONS.md "Map": the camera fits the real route box above the
 * panel; deselect (Q-018) pulls back out to the overview.
 */
import { legFramePoints } from './arcs';
import { DEFAULT_CENTER } from './camera';
import { drawnRoutes, isDrawableLeg } from './routeModel';
import type { CameraTarget, LonLat, RouteLine } from './types';

export function routeFramePoints(routes: readonly RouteLine[]): LonLat[] {
  const out: LonLat[] = [];
  for (const r of routes) {
    for (const leg of r.legs) {
      if (isDrawableLeg(leg)) out.push(...legFramePoints(leg));
      else out.push(leg.from);
    }
  }
  return out;
}

/**
 * - A route is selected: fit that route.
 * - Otherwise: fit every drawn route (the top 10 overview).
 * - No routes: centered on `home` (your location, design round 30), else
 *   the default view (continental US), zoom 1.
 */
export function routeFrameTarget(
  routes: readonly RouteLine[],
  selectedId: string | null,
  home?: LonLat | null,
): CameraTarget {
  const selected = selectedId ? routes.find((r) => r.id === selectedId) : undefined;
  const framed = selected ? [selected] : drawnRoutes(routes, null);
  const points = routeFramePoints(framed);
  if (points.length === 0) return { kind: 'center', center: home ?? DEFAULT_CENTER };
  return { kind: 'fit', points };
}
