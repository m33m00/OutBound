/**
 * Route arcs as a Skia Picture: the dynamic layer between the cached base
 * and rim pictures (staticLayer.ts). Recorded when the camera, routes,
 * selection or theme change; the static pictures are not touched by a
 * selection change.
 *
 * The selected route also gets direction chevrons (item 9).
 *
 * Also returns the projected lines used for tap hit testing, so drawing and
 * hit testing always agree.
 */
import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkPicture,
} from '@shopify/react-native-skia';

import type { ColorScheme, Palette } from '@/theme';

import { legSamples, makeLiftedProjector, projectSamples, runsToSvg, type Runs } from './arcs';
import type { GlobeCamera, Viewport } from './camera';
import { hexToRgb, rgba, type Rgb } from './globeColors';
import type { HitLine } from './hitTest';
import { CHEVRON, chevronPoints, chevronsAlong } from './marks';
import { drawLegs, isDrawableLeg, legStyle, LINE } from './routeModel';
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

export interface RouteLayer {
  picture: SkPicture;
  hitLines: HitLine[];
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

    // Direction chevrons: selected route only, always solid, tier color.
    if (d.role === 'selected') {
      const halo = stroke(rgba(hexToRgb(palette.surface), CHEVRON.haloAlpha), CHEVRON.haloWidth);
      const ink = stroke(style.color, CHEVRON.width);
      for (const c of chevronsAlong(legSamples(d.leg), project)) {
        const pts = chevronPoints(c);
        const cp = Skia.Path.Make();
        cp.moveTo(pts[0].x, pts[0].y);
        cp.lineTo(pts[1].x, pts[1].y);
        cp.lineTo(pts[2].x, pts[2].y);
        canvas.drawPath(cp, halo);
        canvas.drawPath(cp, ink);
      }
    }
  }

  return { picture: recorder.finishRecordingAsPicture(), hitLines };
}
