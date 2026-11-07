/**
 * What the map frames by itself when the screen passes no `cameraTarget`
 * (pure). DECISIONS.md "Map": the camera fits the real route box above the
 * panel; deselect (Q-018) pulls back out to the overview.
 */
import { legFramePoints, linkRouteLegs } from './arcs';
import { DEFAULT_CENTER } from './camera';
import { drawnRoutes, isDrawableLeg } from './routeModel';
import type { CameraTarget, LonLat, RouteLine } from './types';

export function routeFramePoints(routes: readonly RouteLine[]): LonLat[] {
  const out: LonLat[] = [];
  linkRouteLegs(routes);
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
 *   the default view (continental US), at HOME_ZOOM.
 */
/**
 * Home view zoom: closer than the whole-globe fit so your region fills the view
 * (John, 2026-11-02: "a little too zoomed out by default", then "zoom in more" after 1.3, and
 * "zoom a bit more" after 1.8, and round 132 after 2.4: "still zoomed out a little too far").
 */
export const HOME_ZOOM = 3.2;

export function routeFrameTarget(routes: readonly RouteLine[], selectedId: string | null, home?: LonLat | null): CameraTarget {
  const selected = selectedId ? routes.find((r) => r.id === selectedId) : undefined;
  const framed = selected ? [selected] : drawnRoutes(routes, null);
  const points = routeFramePoints(framed);
  if (points.length === 0) return { kind: 'center', center: home ?? DEFAULT_CENTER, zoom: HOME_ZOOM };
  return { kind: 'fit', points };
}

/**
 * Extra top inset that keeps a picked route framed below the legend, so the chip never
 * covers a line (John, 2026-11-01). Zero until the chip has been measured or when it isn't shown.
 */
export function legendReserve(shown: boolean, legendHeight: number, gap: number): number {
  return shown && legendHeight > 0 ? legendHeight + gap : 0;
}
