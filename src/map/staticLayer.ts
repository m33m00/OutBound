/**
 * Records the static globe as Skia Pictures. Re-recorded only when the
 * camera, size, theme or gesture state changes; per frame the canvas just
 * composites the cached pictures (plus dynamic layers from later items).
 *
 * Two pictures so routes/marks (items 4, 9) can sit between them without
 * invalidating either:
 *   base: space, atmosphere glow, ocean, land, borders, state lines
 *   rim:  limb darkening and the globe edge line (drawn above routes)
 * Drawing order and values follow drawGeo/drawOverlay in the v9.1 prototype.
 */
import {
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  type SkCanvas,
  type SkPicture,
} from '@shopify/react-native-skia';
import type { GeoPermissibleObjects, GeoProjection } from 'd3-geo';

import { cameraOrigin, projectionFor, wantsHighDetail, type GlobeCamera, type Viewport } from './camera';
import { getBaseGeo, getStateLines } from './geo';
import { rgba, type GlobeColors } from './globeColors';
import { svgPath } from './paths';

export interface LayerInput {
  camera: GlobeCamera;
  viewport: Viewport;
  colors: GlobeColors;
  /** True while a gesture is moving: lower precision, 110m only, no state lines. */
  fast: boolean;
}

function fillPaint(color: string) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  return p;
}

function strokePaint(color: string, width: number) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setStrokeCap(StrokeCap.Round);
  p.setColor(Skia.Color(color));
  return p;
}

function skPath(projection: GeoProjection, object: GeoPermissibleObjects) {
  const d = svgPath(projection, object);
  return d ? Skia.Path.MakeFromSVGString(d) : null;
}

function circlePath(x: number, y: number, r: number) {
  const p = Skia.Path.Make();
  p.addCircle(x, y, r);
  return p;
}

function record(viewport: Viewport, draw: (canvas: SkCanvas) => void): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));
  draw(canvas);
  return recorder.finishRecordingAsPicture();
}

export function recordBaseLayer({ camera, viewport, colors, fast }: LayerInput): SkPicture {
  return record(viewport, (canvas) => {
    const { x: cx, y: cy } = cameraOrigin(camera, viewport);
    const R = camera.radius;
    const hi = !fast && wantsHighDetail(camera, viewport.width);
    const projection = projectionFor(camera, viewport, fast);

    canvas.drawColor(Skia.Color(colors.space));

    // Atmosphere glow just outside the edge (prototype: R*0.985 -> R*1.14).
    const glow = Skia.Paint();
    glow.setAntiAlias(true);
    glow.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy },
        R * 1.14,
        [
          Skia.Color(rgba(colors.atmosphere, 0.55)),
          Skia.Color(rgba(colors.atmosphere, 0.18)),
          Skia.Color(rgba(colors.atmosphere, 0)),
        ],
        [0.985 / 1.14, (0.985 + 0.25 * 0.155) / 1.14, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawCircle(cx, cy, R * 1.14, glow);

    // Ocean: soft light spot toward the top-left.
    const ocean = Skia.Paint();
    ocean.setAntiAlias(true);
    ocean.setShader(
      Skia.Shader.MakeTwoPointConicalGradient(
        { x: cx - R * 0.35, y: cy - R * 0.35 },
        R * 0.05,
        { x: cx, y: cy },
        R * 1.05,
        [Skia.Color(colors.oceanHi), Skia.Color(colors.oceanLo)],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawCircle(cx, cy, R, ocean);

    canvas.save();
    canvas.clipPath(circlePath(cx, cy, R), ClipOp.Intersect, true);

    const geo = getBaseGeo(hi ? 'high' : 'low');
    const land = skPath(projection, geo.land);
    if (land) canvas.drawPath(land, fillPaint(colors.land));

    if (!fast) {
      const states = skPath(projection, getStateLines());
      if (states) canvas.drawPath(states, strokePaint(hi ? colors.stateLineHi : colors.stateLine, hi ? 0.9 : 0.75));
    }

    const borders = skPath(projection, geo.borders);
    if (borders) canvas.drawPath(borders, strokePaint(colors.landEdge, hi ? 0.7 : 0.6));
    if (land) canvas.drawPath(land, strokePaint(colors.landEdge, 0.8));

    canvas.restore();
  });
}

export function recordRimLayer({ camera, viewport, colors }: LayerInput): SkPicture {
  return record(viewport, (canvas) => {
    const { x: cx, y: cy } = cameraOrigin(camera, viewport);
    const R = camera.radius;

    const limb = Skia.Paint();
    limb.setAntiAlias(true);
    limb.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy },
        R,
        [Skia.Color('rgba(0,0,0,0)'), Skia.Color(colors.limb)],
        [0.62, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawCircle(cx, cy, R, limb);

    canvas.drawCircle(cx, cy, R, strokePaint(rgba(colors.atmosphere, 0.35), 1.2));
  });
}
