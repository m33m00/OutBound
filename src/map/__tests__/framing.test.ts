import { arcSamples, makeLiftedProjector } from '../arcs';
import { DEFAULT_CENTER, cameraForTarget, normalizeInsets, type Viewport } from '../camera';
import { devSampleRoutes } from '../devSampleRoutes';
import { routeFramePoints, routeFrameTarget } from '../framing';

describe('routeFrameTarget (auto camera)', () => {
  it('no routes: the default view', () => {
    expect(routeFrameTarget([], null)).toEqual({ kind: 'center', center: DEFAULT_CENTER });
    // Design round 30: with no routes it rests on your location when known.
    expect(routeFrameTarget([], null, [-97.04, 32.9])).toEqual({ kind: 'center', center: [-97.04, 32.9] });
    expect(routeFrameTarget([], null, null)).toEqual({ kind: 'center', center: DEFAULT_CENTER });
  });

  it('nothing selected: fits every drawn route (top 10 only)', () => {
    const t = routeFrameTarget(devSampleRoutes, null);
    expect(t.kind).toBe('fit');
    const pts = t.kind === 'fit' ? t.points : [];
    expect(pts).toEqual(routeFramePoints(devSampleRoutes.slice(0, 10)));
    // 11th route (DFW -> JFK) is not drawn, so not framed by its own points.
    expect(pts.length).toBe(routeFramePoints(devSampleRoutes.slice(0, 10)).length);
  });

  it('selected: fits only that route', () => {
    const sel = devSampleRoutes[1];
    const t = routeFrameTarget(devSampleRoutes, sel.id);
    expect(t).toEqual({ kind: 'fit', points: routeFramePoints([sel]) });
    // 2 legs x (2 ends + 3 great-circle points)
    expect(t.kind === 'fit' && t.points.length).toBe(10);
  });

  it('deselect returns to the overview fit', () => {
    const selected = routeFrameTarget(devSampleRoutes, 'dev-4');
    const back = routeFrameTarget(devSampleRoutes, null);
    expect(back).not.toEqual(selected);
    expect(back).toEqual(routeFrameTarget(devSampleRoutes, null));
  });

  it('an unknown selected id falls back to the overview', () => {
    expect(routeFrameTarget(devSampleRoutes, 'missing')).toEqual(routeFrameTarget(devSampleRoutes, null));
  });
});

describe('fitted arcs stay above the panel', () => {
  const vp: Viewport = { width: 390, height: 760, insets: normalizeInsets({ top: 8, right: 56, bottom: 380 }) };

  for (const id of [null, 'dev-2', 'dev-10', 'dev-1']) {
    it(`lifted arcs fit the visible area (${id ?? 'overview'})`, () => {
      const cam = cameraForTarget(routeFrameTarget(devSampleRoutes, id), vp, null);
      const project = makeLiftedProjector(cam, vp);
      const routes = id ? devSampleRoutes.filter((r) => r.id === id) : devSampleRoutes.slice(0, 10);
      const slack = 8; // padding is 32; lift may use a little of it
      for (const leg of routes.flatMap((r) => r.legs)) {
        for (const s of arcSamples(leg.from, leg.to)) {
          const p = project(s.ll, s.lift);
          expect(p.visible).toBe(true);
          expect(p.x).toBeGreaterThanOrEqual(vp.insets.left + slack);
          expect(p.x).toBeLessThanOrEqual(vp.width - vp.insets.right - slack);
          expect(p.y).toBeGreaterThanOrEqual(vp.insets.top + slack);
          expect(p.y).toBeLessThanOrEqual(vp.height - vp.insets.bottom - slack);
        }
      }
    });
  }
});
