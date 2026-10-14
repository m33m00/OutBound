import { geoBounds, geoOrthographic } from 'd3-geo';

import { getBaseGeo, getStateLines } from '../geo';
import { svgPath } from '../paths';

describe('bundled geography', () => {
  it('decodes 110m land and country borders', () => {
    const { land, borders } = getBaseGeo('low');
    expect((land as { type: string }).type).toBe('FeatureCollection');
    expect(borders.type).toBe('MultiLineString');
    expect(borders.coordinates.length).toBeGreaterThan(100);
  });

  it('decodes once and returns the same objects', () => {
    expect(getBaseGeo('low')).toBe(getBaseGeo('low'));
    expect(getStateLines()).toBe(getStateLines());
  });

  it('lazily decodes 50m and caches it', () => {
    const hi = getBaseGeo('high');
    expect(hi).toBe(getBaseGeo('high'));
    expect(hi.borders.coordinates.length).toBeGreaterThan(
      getBaseGeo('low').borders.coordinates.length,
    );
  });

  it('state lines are inner borders inside the US', () => {
    const states = getStateLines();
    expect(states.type).toBe('MultiLineString');
    expect(states.coordinates.length).toBeGreaterThan(50);
    const [[w, s], [e, n]] = geoBounds(states);
    // Lower 48 inner lines; no coastline, so nothing in Alaska/Hawaii.
    expect(w).toBeGreaterThan(-125);
    expect(e).toBeLessThan(-66);
    expect(s).toBeGreaterThan(24);
    expect(n).toBeLessThan(50);
  });
});

describe('svgPath', () => {
  const proj = geoOrthographic().rotate([97, -38]).scale(300).translate([200, 300]).clipAngle(90);

  it('projects land to an SVG path', () => {
    const d = svgPath(proj, getBaseGeo('low').land);
    expect(d).toMatch(/^M/);
  });

  it('returns null when nothing is visible', () => {
    // A tiny polygon on the far side of the globe (clockwise = d3 exterior ring).
    const far = {
      type: 'Polygon' as const,
      coordinates: [[[83, -38], [83, -37], [84, -37], [84, -38], [83, -38]]],
    };
    expect(svgPath(proj, far)).toBeNull();
  });
});
