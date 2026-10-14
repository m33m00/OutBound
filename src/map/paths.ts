/**
 * Projects geography to SVG path strings (pure, no Skia). Building one string
 * per layer and handing it to Skia in a single call is much cheaper than one
 * native call per vertex.
 */
import { geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';

/** 0.1 pt precision is invisible on screen and keeps strings short. */
const DIGITS = 1;

/** SVG path data for `object` under `projection`, or null if nothing is visible. */
export function svgPath(projection: GeoProjection, object: GeoPermissibleObjects): string | null {
  const d = geoPath(projection).digits(DIGITS)(object);
  return d && d.length > 0 ? d : null;
}
