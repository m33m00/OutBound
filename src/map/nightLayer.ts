/**
 * Day/night as a Skia Picture (backlog item 11): its own dynamic layer
 * between the cached base picture and radar, so radar colors are never
 * tinted (Q-033) and the static globe is never re-recorded for the sun.
 *
 * Approach: one RuntimeEffect shader over the globe disk. Per pixel it
 * rebuilds the view-space normal of the orthographic sphere
 * (x, y, sqrt(1 - x^2 - y^2)), dots it with the sun direction (a uniform,
 * computed once per record on the JS side) and applies the same night /
 * dusk curve as sun.ts. Recording is one drawCircle, so re-recording on
 * camera change, sun change or preview (~9 Hz) costs next to nothing; the
 * GPU does the per-pixel work. A vertex mesh with per-vertex colors was the
 * alternative, but the dusk band is only a few degrees wide, so it would
 * need a dense grid (and per-record JS work) to avoid banding.
 *
 * Below the night: a subtle white sun highlight on the lit side.
 * If the shader fails to compile, the layer draws only the highlight.
 */
import { ClipOp, Skia, TileMode, type SkPicture, type SkRuntimeEffect } from '@shopify/react-native-skia';

import { cameraOrigin, type GlobeCamera, type Viewport } from './camera';
import type { Rgb } from './globeColors';
import { NIGHT, SUN_HIGHLIGHT, sunViewVector, type NightTheme } from './sun';
import type { LonLat } from './types';

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** SkSL source, built from the same constants as nightAlpha() in sun.ts. */
export const NIGHT_SKSL = `
uniform float2 center;
uniform float radius;
uniform float3 sun;
uniform float3 nightRgb;
uniform float3 duskRgb;
uniform float nightA;

half4 main(float2 pos) {
  float2 v = (pos - center) / radius;
  v.y = -v.y;
  float r2 = dot(v, v);
  if (r2 >= 1.0) { return half4(0.0); }
  float z = sqrt(1.0 - r2);
  float d = v.x * sun.x + v.y * sun.y + z * sun.z;
  float t = clamp((${f(NIGHT.start)} - d) / ${f(NIGHT.span)}, 0.0, 1.0);
  float nA = nightA * t * t * (3.0 - 2.0 * t);
  float gz = (d - (${f(NIGHT.duskCenter)})) / ${f(NIGHT.duskWidth)};
  float gA = ${f(NIGHT.duskPeak)} * exp(-gz * gz);
  float tA = nA + gA;
  if (tA < ${f(NIGHT.minAlpha)}) { return half4(0.0); }
  float3 rgb = (duskRgb * gA + nightRgb * nA) / tA;
  float a = 1.0 - (1.0 - nA) * (1.0 - gA);
  return half4(half3(rgb * a), half(a));
}
`;

let effect: SkRuntimeEffect | null | undefined;

function nightEffect(): SkRuntimeEffect | null {
  if (effect === undefined) {
    try {
      effect = Skia.RuntimeEffect.Make(NIGHT_SKSL);
    } catch {
      effect = null;
    }
  }
  return effect;
}

const unit = (c: Rgb) => [c[0] / 255, c[1] / 255, c[2] / 255];

/** Uniform values in declaration order (exported for tests). */
export function nightUniforms(
  camera: GlobeCamera,
  viewport: Viewport,
  sun: LonLat,
  theme: NightTheme,
): number[] {
  const o = cameraOrigin(camera, viewport);
  return [
    o.x,
    o.y,
    camera.radius,
    ...sunViewVector(camera, sun),
    ...unit(theme.night),
    ...unit(theme.dusk),
    theme.nightAlpha * NIGHT.alphaGain,
  ];
}

/** Highlight alpha for the sun's view-space z (0 when on the far side). */
export function highlightAlpha(sunZ: number): number {
  if (sunZ <= 0) return 0;
  return SUN_HIGHLIGHT.alpha * Math.min(1, sunZ / SUN_HIGHLIGHT.fadeZ);
}

export interface NightLayerInput {
  camera: GlobeCamera;
  viewport: Viewport;
  sun: LonLat;
  theme: NightTheme;
}

export function recordNightLayer({ camera, viewport, sun, theme }: NightLayerInput): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));
  const { x: cx, y: cy } = cameraOrigin(camera, viewport);
  const R = camera.radius;
  const [sx, sy, sz] = sunViewVector(camera, sun);

  const hA = highlightAlpha(sz);
  if (hA > 0) {
    const clip = Skia.Path.Circle(cx, cy, R);
    canvas.save();
    canvas.clipPath(clip, ClipOp.Intersect, true);
    const lx = cx + R * sx;
    const ly = cy - R * sy;
    const glow = Skia.Paint();
    glow.setAntiAlias(true);
    glow.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: lx, y: ly },
        R * SUN_HIGHLIGHT.radius,
        [Skia.Color(`rgba(255,255,255,${hA})`), Skia.Color('rgba(255,255,255,0)')],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawCircle(lx, ly, R * SUN_HIGHLIGHT.radius, glow);
    canvas.restore();
  }

  const fx = nightEffect();
  if (fx) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(fx.makeShader(nightUniforms(camera, viewport, sun, theme)));
    canvas.drawCircle(cx, cy, R, paint);
  }
  return recorder.finishRecordingAsPicture();
}
