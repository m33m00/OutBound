/**
 * Flight preview plane (backlog item 11). The glyph (accent halo, shadow,
 * white plane, accent outline) is recorded ONCE per accent color as a Skia
 * Picture centered on (0, 0), nose up. Per frame only a transform changes
 * (planeTransform), which GlobeMap feeds to Skia through a Reanimated shared
 * value, so React does not re-render and nothing is re-recorded per frame.
 * Look follows drawPlaneAt / drawSimPlane in the v9.1 prototype.
 */
import { BlurStyle, PaintStyle, Skia, type SkPicture } from '@shopify/react-native-skia';

import { hexToRgb, rgba } from './globeColors';
import { PREVIEW, type PlanePose } from './preview';

/** Prototype PLANE glyph, 24 x 24 box, nose up at (12, 2). */
export const PLANE_SVG =
  'M12 2c.8 0 1.4.7 1.4 1.6V9l7.6 4.4v2.1l-7.6-2.3v4.9l2.2 1.6V21l-3.6-1-3.6 1v-1.3l2.2-1.6v-4.9L3 15.5v-2.1L10.6 9V3.6C10.6 2.7 11.2 2 12 2z';

/** Half-size of the recorded box (halo radius plus blur room). */
const BOX = PREVIEW.haloRadius + 8;

/** The plane glyph at the origin, nose up. Record once per accent. */
export function recordPlaneGlyph(accent: string): SkPicture | null {
  const path = Skia.Path.MakeFromSVGString(PLANE_SVG);
  if (!path) return null;
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-BOX, -BOX, 2 * BOX, 2 * BOX));

  const halo = Skia.Paint();
  halo.setAntiAlias(true);
  halo.setColor(Skia.Color(rgba(hexToRgb(accent), PREVIEW.haloAlpha)));
  canvas.drawCircle(0, 0, PREVIEW.haloRadius, halo);

  canvas.save();
  canvas.scale(PREVIEW.planeScale, PREVIEW.planeScale);
  canvas.translate(-12, -12);

  const shadow = Skia.Paint();
  shadow.setAntiAlias(true);
  shadow.setColor(Skia.Color(PREVIEW.planeShadow));
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, PREVIEW.planeShadowBlur, true));
  canvas.drawPath(path, shadow);

  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Skia.Color(PREVIEW.planeFill));
  canvas.drawPath(path, fill);

  const outline = Skia.Paint();
  outline.setAntiAlias(true);
  outline.setStyle(PaintStyle.Stroke);
  outline.setStrokeWidth(PREVIEW.planeStrokeWidth);
  outline.setColor(Skia.Color(accent));
  canvas.drawPath(path, outline);

  canvas.restore();
  return recorder.finishRecordingAsPicture();
}

export type PlaneTransform = [{ translateX: number }, { translateY: number }, { rotate: number }];

/** Transform that places the origin-centered glyph at a pose (rotate in radians). */
export function planeTransform(pose: PlanePose): PlaneTransform {
  return [{ translateX: pose.x }, { translateY: pose.y }, { rotate: pose.angle + Math.PI / 2 }];
}
