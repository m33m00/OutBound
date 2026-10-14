/**
 * Radar overlay as a Skia Picture (backlog item 14): its own layer between
 * the cached static base picture and the route picture, so the static
 * globe is never re-recorded for radar. Re-recorded only when the camera,
 * size, scheme or the decoded images change (the mesh math is in radar.ts).
 *
 * Images are decoded once per region + observedAt (RadarImageCache) with
 * Skia.Image.MakeImageFromEncoded; a Picture keeps its own reference to an
 * image, so disposing a replaced image is safe while an old picture is
 * still on screen.
 */
import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  VertexMode,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';

import type { GlobeCamera, Viewport } from './camera';
import { radarMesh, RadarImageCache, type DecodedRadar } from './radar';

export function decodeRadarImage(bytes: Uint8Array): SkImage | null {
  if (bytes.length === 0) return null;
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
}

export function makeRadarImageCache(): RadarImageCache<SkImage> {
  return new RadarImageCache<SkImage>(decodeRadarImage, (image) => image.dispose());
}

export interface RadarLayerInput {
  camera: GlobeCamera;
  viewport: Viewport;
  layers: readonly DecodedRadar<SkImage>[];
  opacity: number;
}

/** Picture of all visible radar meshes, or null when none is on screen. */
export function recordRadarLayer({ camera, viewport, layers, opacity }: RadarLayerInput): SkPicture | null {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, viewport.width, viewport.height));
  let drew = false;
  for (const { bbox, image } of layers) {
    const mesh = radarMesh(bbox, camera, viewport, { width: image.width(), height: image.height() });
    if (!mesh) continue;
    const vertices = Skia.MakeVertices(VertexMode.Triangles, mesh.positions, mesh.texCoords, undefined, mesh.indices);
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setAlphaf(opacity);
    paint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None));
    // No per-vertex colors, so the shader alone colors the triangles.
    canvas.drawVertices(vertices, BlendMode.Dst, paint);
    drew = true;
  }
  const picture = recorder.finishRecordingAsPicture();
  return drew ? picture : null;
}
