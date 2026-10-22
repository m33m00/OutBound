/**
 * Airport marks and labels as a Skia Picture (backlog item 9). Dynamic, like
 * the route layer: re-recorded per camera / selection / theme, never part of
 * the cached static globe. Cheap: a handful of circles and short strings.
 *
 * Marks are not tappable; route hit testing ignores them. Airport status
 * badges (item 7, status.ts) are drawn here too, on top of the marks, and
 * count as label obstacles. Leg flight-time pills (item 15, legTimes.ts)
 * are placed after the IATA labels, which win any collision.
 */
import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkFont,
  type SkPicture,
} from '@shopify/react-native-skia';

import { legSamples, type LiftedProjector } from './arcs';
import type { Viewport } from './camera';
import {
  LEG_TIME_PILL,
  legTimeAnchor,
  legTimeArea,
  placeLegTimes,
  type LegTimeColors,
  type LegTimeRequest,
  type LegTimeSpec,
} from './legTimes';
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
  type Box,
  type LabelRequest,
  type MarkColors,
  type MarkSpec,
  type ScreenMark,
} from './marks';
import {
  STATUS_BADGE,
  statusExtent,
  statusShapePoints,
  visibleStatus,
  type ScreenStatus,
  type StatusColors,
  type StatusSpec,
} from './status';
import type { RouteLine } from './types';

export interface MarksLayerInput {
  project: LiftedProjector;
  viewport: Viewport;
  marks: readonly MarkSpec[];
  colors: MarkColors;
  /** Null while fonts load: marks draw, labels wait. */
  fonts: MarkFonts | null;
  /** Airport status badges (item 7), from `statusSet`. */
  statuses?: readonly StatusSpec[];
  statusColors?: StatusColors;
  /** Leg time pills (item 15), from `legTimeSpecs` for `selectedRoute`. */
  legTimes?: readonly LegTimeSpec[];
  selectedRoute?: RouteLine | null;
  legTimeFont?: SkFont | null;
  legTimeColors?: LegTimeColors;
  /** Screen box of the legend, if shown: pills never cover it. */
  legendBox?: Box | null;
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
  const b = Skia.PathBuilder.Make();
  b.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) b.lineTo(pts[i].x, pts[i].y);
  canvas.drawPath(b.detach(), p);
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

function drawStatus(canvas: SkCanvas, s: ScreenStatus, c: StatusColors) {
  const pts = statusShapePoints(s.level, s.x, s.y);
  const path = Skia.Path.Polygon(pts, true);
  if (s.dim) {
    // One layer so the halo does not show through the faded fill.
    const layer = Skia.Paint();
    layer.setAlphaf(STATUS_BADGE.dimAlpha);
    canvas.saveLayer(layer);
  }
  canvas.drawPath(path, paint(c.halo, PaintStyle.Stroke, STATUS_BADGE.halo));
  canvas.drawPath(path, paint(c.halo, PaintStyle.Fill));
  canvas.drawPath(path, paint(s.level === 'caution' ? c.caution : c.likelyDelays, PaintStyle.Fill));
  if (s.dim) canvas.restore();
}

function circleBox(x: number, y: number, r: number): Box {
  return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
}

function drawLegTimes(
  canvas: SkCanvas,
  args: {
    project: LiftedProjector;
    viewport: Viewport;
    specs: readonly LegTimeSpec[];
    route: RouteLine;
    font: SkFont;
    colors: LegTimeColors;
    obstacles: readonly Box[];
  },
) {
  const { project, viewport, specs, route, font, colors, obstacles } = args;
  const cap = font.measureText('0');
  const measured = specs.map((s) => ({ s, text: font.measureText(s.text) }));
  const requests: LegTimeRequest[] = measured.map(({ s, text }) => {
    const leg = route.legs[s.legIndex];
    return {
      id: s.legId,
      anchor: leg ? legTimeAnchor(legSamples(leg), project) : null,
      width: text.width + LEG_TIME_PILL.padX * 2,
      height: LEG_TIME_PILL.height,
    };
  });
  const placed = placeLegTimes(
    requests,
    obstacles,
    legTimeArea(viewport.width, viewport.height, viewport.insets),
  );
  const pill = paint(colors.pill, PaintStyle.Fill);
  const fill = paint(colors.text, PaintStyle.Fill);
  for (const p of placed) {
    const m = measured.find((x) => x.s.legId === p.id)!;
    const w = m.text.width + LEG_TIME_PILL.padX * 2;
    const h = LEG_TIME_PILL.height;
    const rect = Skia.XYWHRect(p.x - w / 2, p.y - h / 2, w, h);
    canvas.drawRRect(Skia.RRectXY(rect, LEG_TIME_PILL.radius, LEG_TIME_PILL.radius), pill);
    const x = p.x - w / 2 + LEG_TIME_PILL.padX - m.text.x;
    const baseline = p.y - (cap.y + cap.height / 2);
    canvas.drawText(m.s.text, x, baseline, fill, font);
  }
}

export function recordMarksLayer({
  project,
  viewport,
  marks,
  colors,
  fonts,
  statuses = [],
  statusColors,
  legTimes = [],
  selectedRoute,
  legTimeFont,
  legTimeColors,
  legendBox,
}: MarksLayerInput): SkPicture | null {
  const shown = visibleMarks(marks, project, viewport);
  const badges = statusColors ? visibleStatus(statuses, project, viewport) : [];
  const wantTimes = legTimes.length > 0 && selectedRoute != null && legTimeFont != null && legTimeColors != null;
  if (shown.length === 0 && badges.length === 0 && !wantTimes) return null;

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));

  const markBoxes: Box[] = [
    ...shown.map((m) => circleBox(m.x, m.y, markExtent(m.kind))),
    ...badges.map((b) => circleBox(b.x, b.y, statusExtent(b.level))),
  ];
  const labelBoxes: Box[] = [];

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
      [
        ...shown.map((m) => ({ id: m.code, x: m.x, y: m.y, r: markExtent(m.kind) })),
        ...badges.map((b) => ({ id: b.id, x: b.x, y: b.y, r: statusExtent(b.level) })),
      ],
    );
    const fill = paint(colors.label, PaintStyle.Fill);
    placed.forEach((p, i) => {
      const { m, font, text, cap } = measured[i];
      const x = p.x - text.x;
      const baseline = p.y - (cap.y + cap.height / 2);
      const halo = paint(colors.halo, PaintStyle.Stroke, LABEL_FONT[m.kind].halo);
      canvas.drawText(m.label, x, baseline, halo, font);
      canvas.drawText(m.label, x, baseline, fill, font);
      labelBoxes.push(p.box);
    });
  }

  // Leg time pills (item 15): after IATA labels so those win; drawn under
  // the marks. Not hit tested anywhere.
  if (wantTimes) drawLegTimes(canvas, {
    project,
    viewport,
    specs: legTimes,
    route: selectedRoute!,
    font: legTimeFont!,
    colors: legTimeColors!,
    obstacles: [...labelBoxes, ...markBoxes, ...(legendBox ? [legendBox] : [])],
  });

  for (const m of shown) drawMark(canvas, m, colors);
  // Badges last: they sit beside the marks (never over them), above labels.
  if (statusColors) for (const b of badges) drawStatus(canvas, b, statusColors);

  return recorder.finishRecordingAsPicture();
}
