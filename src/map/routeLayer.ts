/**
 * Route arcs as a Skia Picture: the dynamic layer between the cached base
 * and rim pictures (staticLayer.ts). Recorded when the camera, routes,
 * selection or theme change; the static pictures are not touched by a
 * selection change.
 *
 * Plain lines and seat colors only: no direction chevrons since round 156 (John: "Just do lines and
 * colors. No direction arrows either").
 *
 * Also returns the projected lines used for tap hit testing, so drawing and
 * hit testing always agree.
 */
import { BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkPath, type SkPicture } from '@shopify/react-native-skia';

import type { ColorScheme, Palette } from '@/theme';

import { legSamples, makeLiftedProjector, projectSamples, runsToSvg, type Runs } from './arcs';
import type { GlobeCamera, Viewport } from './camera';
import { hexToRgb, rgba, type Rgb } from './globeColors';
import type { HitLine } from './hitTest';
import { legTimeAnchor } from './legTimes';
import { CANCELED_X, canceledXSegments, drawLegs, isDrawableLeg, legStyle, LINE } from './routeModel';
import type { RouteLine } from './types';

export interface RouteLayerInput {
  camera: GlobeCamera;
  viewport: Viewport;
  palette: Palette;
  scheme: ColorScheme;
  /** Ground shadow under the selected arc (globeColors). */
  routeShadow: Rgb;
  routeShadowAlpha: number;
  /** Routes to draw (already limited to the top 10 + selected), list order. */
  routes: readonly RouteLine[];
  selectedId: string | null;
}

/** One leg's slow pulse (pulse.ts), drawn live over the recorded picture. */
export interface RoutePulse {
  key: string;
  path: SkPath;
  width: number;
  /** Place in its route, so a connection pulses leg by leg. */
  legIndex: number;
  legCount: number;
  selected: boolean;
}

export interface RouteLayer {
  picture: SkPicture;
  hitLines: HitLine[];
  pulses: RoutePulse[];
}

function stroke(color: string, width: number) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeCap(StrokeCap.Round);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setColor(Skia.Color(color));
  return p;
}

export function recordRouteLayer(input: RouteLayerInput): RouteLayer {
  const { camera, viewport, palette, scheme, routeShadow, routeShadowAlpha, routes, selectedId } = input;
  const project = makeLiftedProjector(camera, viewport);

  // Hit lines: every drawn route, every leg, in list order.
  const hitLines: HitLine[] = [];
  const runsByLeg = new Map<RouteLine['legs'][number], Runs>();
  for (const r of routes) {
    for (const leg of r.legs) {
      if (!isDrawableLeg(leg)) continue;
      const runs = projectSamples(legSamples(leg), project);
      runsByLeg.set(leg, runs);
      hitLines.push({ routeId: r.id, runs });
    }
  }

  const pulses: RoutePulse[] = [];
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));

  for (const d of drawLegs(routes, selectedId)) {
    const runs = runsByLeg.get(d.leg) ?? projectSamples(legSamples(d.leg), project);
    const svg = runsToSvg(runs);
    if (!svg) continue;
    const path = Skia.Path.MakeFromSVGString(svg);
    if (!path) continue;
    const style = legStyle(d.leg, d.role, palette, scheme);

    if (style.shadowAlpha != null) {
      const ground = runsToSvg(projectSamples(legSamples(d.leg), project, true));
      const gp = ground ? Skia.Path.MakeFromSVGString(ground) : null;
      if (gp) {
        const color = rgba(routeShadow, routeShadowAlpha * style.shadowAlpha);
        canvas.drawPath(gp, stroke(color, style.width * LINE.shadowWidth));
      }
    }
    if (style.halo) canvas.drawPath(path, stroke(style.halo.color, style.halo.width));
    if (style.glow) {
      const glow = stroke(style.glow.color, style.width);
      glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, style.glow.sigma, true));
      canvas.drawPath(path, glow);
    }
    const line = stroke(style.color, style.width);
    if (style.dash) {
      const effect = Skia.PathEffect.MakeDash([...style.dash], 0);
      if (effect) line.setPathEffect(effect);
    }
    canvas.drawPath(path, line);
    const route = routes.find((r) => r.id === d.routeId);
    // Canceled: an X at the middle of the line, and no pulse (nothing is flying there).
    if (d.leg.canceled && d.role === 'selected') {
      const mid = legTimeAnchor(legSamples(d.leg), project, CANCELED_X.t);
      if (mid) {
        const disc = Skia.Paint();
        disc.setAntiAlias(true);
        disc.setColor(Skia.Color(palette.surface));
        canvas.drawCircle(mid.x, mid.y, CANCELED_X.disc, disc);
        const x = stroke(style.color, CANCELED_X.width);
        for (const [x0, y0, x1, y1] of canceledXSegments(mid.x, mid.y)) canvas.drawLine(x0, y0, x1, y1, x);
      }
      continue;
    }
    const legIndex = route ? route.legs.indexOf(d.leg) : 0;
    pulses.push({
      key: `${d.routeId}:${legIndex}:${d.role}`,
      path,
      width: style.width,
      legIndex: Math.max(0, legIndex),
      legCount: route?.legs.length ?? 1,
      selected: d.role === 'selected',
    });
  }

  return { picture: recorder.finishRecordingAsPicture(), hitLines, pulses };
}
