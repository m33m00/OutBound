/**
 * Airport marks and labels as a Skia Picture (backlog item 9). Dynamic, like
 * the route layer: re-recorded per camera / selection / theme, never part of
 * the cached static globe. Cheap: a handful of circles and short strings.
 *
 * Marks are not tappable; route hit testing ignores them.
 */
import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkPicture,
} from '@shopify/react-native-skia';

import type { LiftedProjector } from './arcs';
import type { Viewport } from './camera';
import type { MarkFonts } from './markFonts';
import {
  houseGlyph,
  labelBounds,
  labelOrder,
  LABEL_FONT,
  MARK,
  markExtent,
  placeLabels,
  visibleMarks,
  type LabelRequest,
  type MarkColors,
  type MarkSpec,
  type ScreenMark,
} from './marks';

export interface MarksLayerInput {
  project: LiftedProjector;
  viewport: Viewport;
  marks: readonly MarkSpec[];
  colors: MarkColors;
  /** Null while fonts load: marks draw, labels wait. */
  fonts: MarkFonts | null;
}

function paint(color: string, style: PaintStyle, width = 0) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(style);
  p.setColor(Skia.Color(color));
  if (style === PaintStyle.Stroke) {
    p.setStrokeWidth(width);
    p.setStrokeCap(StrokeCap.Round);
    p.setStrokeJoin(StrokeJoin.Round);
  }
  return p;
}

function polyline(canvas: SkCanvas, pts: readonly { x: number; y: number }[], p: ReturnType<typeof paint>) {
  const path = Skia.Path.Make();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  canvas.drawPath(path, p);
}

function drawHomePin(canvas: SkCanvas, m: ScreenMark, c: MarkColors, outline: boolean) {
  const spec = outline ? MARK.altHome : MARK.home;
  const r = spec.r;
  if (outline) {
    canvas.drawCircle(m.x, m.y, r, paint(c.halo, PaintStyle.Fill));
    canvas.drawCircle(m.x, m.y, r, paint(c.you, PaintStyle.Stroke, spec.stroke));
  } else {
    const shadow = paint(c.homeShadow, PaintStyle.Fill);
    shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, MARK.home.shadowSigma, true));
    canvas.drawCircle(m.x, m.y, r, shadow);
    canvas.drawCircle(m.x, m.y, r, paint(c.you, PaintStyle.Fill));
    canvas.drawCircle(m.x, m.y, r, paint(c.homeRing, PaintStyle.Stroke, spec.stroke));
  }
  const glyph = paint(outline ? c.you : c.homeGlyph, PaintStyle.Stroke, spec.glyphWidth);
  const g = houseGlyph(m.x, m.y, r);
  polyline(canvas, g.roof, glyph);
  polyline(canvas, g.walls, glyph);
}

function drawMark(canvas: SkCanvas, m: ScreenMark, c: MarkColors) {
  switch (m.kind) {
    case 'home':
      return drawHomePin(canvas, m, c, false);
    case 'altHome':
      return drawHomePin(canvas, m, c, true);
    case 'origin':
      canvas.drawCircle(m.x, m.y, MARK.origin.r, paint(c.accent, PaintStyle.Fill));
      canvas.drawCircle(m.x, m.y, MARK.origin.r, paint(c.halo, PaintStyle.Stroke, MARK.origin.stroke));
      return;
    case 'destination':
    case 'stop': {
      const s = MARK[m.kind];
      canvas.drawCircle(m.x, m.y, s.r, paint(c.halo, PaintStyle.Fill));
      canvas.drawCircle(m.x, m.y, s.r, paint(m.kind === 'destination' ? c.accent : c.label, PaintStyle.Stroke, s.stroke));
      return;
    }
  }
}

export function recordMarksLayer({ project, viewport, marks, colors, fonts }: MarksLayerInput): SkPicture | null {
  const shown = visibleMarks(marks, project, viewport);
  if (shown.length === 0) return null;

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));

  // Labels first (under marks), so a nudged label never hides a pin.
  if (fonts) {
    const ordered = labelOrder(shown) as ScreenMark[];
    const measured = ordered.map((m) => {
      const font = fonts[m.kind];
      const text = font.measureText(m.label);
      const cap = font.measureText('H');
      return { m, font, text, cap };
    });
    const requests: LabelRequest[] = measured.map(({ m, text, cap }) => ({
      id: m.code,
      kind: m.kind,
      x: m.x,
      y: m.y,
      width: text.width,
      height: cap.height + LABEL_FONT[m.kind].halo,
    }));
    const placed = placeLabels(
      requests,
      labelBounds(viewport.width, viewport.insets),
      shown.map((m) => ({ id: m.code, x: m.x, y: m.y, r: markExtent(m.kind) })),
    );
    const fill = paint(colors.label, PaintStyle.Fill);
    placed.forEach((p, i) => {
      const { m, font, text, cap } = measured[i];
      const x = p.x - text.x;
      const baseline = p.y - (cap.y + cap.height / 2);
      const halo = paint(colors.halo, PaintStyle.Stroke, LABEL_FONT[m.kind].halo);
      canvas.drawText(m.label, x, baseline, halo, font);
      canvas.drawText(m.label, x, baseline, fill, font);
    });
  }

  for (const m of shown) drawMark(canvas, m, colors);

  return recorder.finishRecordingAsPicture();
}
