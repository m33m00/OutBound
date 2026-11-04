import {
  BlendMode,
  BlurStyle,
  Canvas,
  FilterMode,
  MipmapMode,
  Picture,
  Skia,
  TileMode,
  VertexMode,
  makeImageFromView,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { impactTick } from './haptics';
import { poseAt, TEAR_MESH, TEAR_STEPS, TEAR_TOTAL_MS, tearMesh, type MeshPart, type TearGeometry } from './tearMesh';

/**
 * The save tear drawn as real bent paper (round 132): a picture of the route card, laid on the mesh
 * from tearMesh.ts and redrawn on the JS thread each frame (no Reanimated, like the route pulse).
 * Only loaded when a tear runs, so nothing else pulls in Skia for it.
 */
export interface MeshFlightProps {
  image: SkImage;
  /** The card's top left in the host, and its size and perforation in points. */
  x: number;
  y: number;
  geometry: TearGeometry;
  width: number;
  height: number;
  onDone: () => void;
}

/** The plain back of the paper, seen once the curl rolls over. */
const BACK = [0.965, 0.965, 0.95];

function outline(part: MeshPart, cols: number, rows: number): { x: number; y: number }[] {
  const w = cols + 1;
  const at = (i: number, j: number) => part.positions[j * w + i];
  const out = [];
  for (let i = 0; i <= cols; i++) out.push(at(i, 0));
  for (let j = 1; j <= rows; j++) out.push(at(cols, j));
  for (let i = cols - 1; i >= 0; i--) out.push(at(i, rows));
  for (let j = rows - 1; j > 0; j--) out.push(at(0, j));
  return out;
}

export function recordTearFrame(
  p: Omit<MeshFlightProps, 'onDone'> & { canvasWidth: number; canvasHeight: number },
  ms: number,
): SkPicture {
  const pose = poseAt(ms);
  const mesh = tearMesh(p.geometry, pose);
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, p.canvasWidth, p.canvasHeight));
  canvas.translate(p.x, p.y);
  const kx = p.image.width() / p.geometry.width;
  const ky = p.image.height() / p.geometry.height;

  // A soft shadow under the card while it's in your hands, and under the lifted stub.
  const shadow = (part: MeshPart, rows: number, strength: number, dx: number, dy: number) => {
    if (strength <= 0.01) return;
    const pts = outline(part, TEAR_MESH.cols, rows);
    const path = Skia.Path.Polygon(
      pts.map((q) => ({ x: q.x + dx, y: q.y + dy })),
      true,
    );
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(`rgba(0,0,0,${(0.22 * strength).toFixed(3)})`));
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 10, true));
    canvas.drawPath(path, paint);
  };
  const held = pose.lift * (1 - pose.fly);
  shadow(mesh.body, TEAR_MESH.bodyRows, held, 4, 10);

  const draw = (part: MeshPart, opacity: number) => {
    const textures = part.textures.map((t) => ({ x: t.x * kx, y: t.y * ky }));
    const colors = part.shade.map((s) => Float32Array.of(s, s, s, 1));
    if (part.indices.length) {
      const verts = Skia.MakeVertices(VertexMode.Triangles, part.positions, textures, colors, part.indices);
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setAlphaf(opacity);
      paint.setShader(p.image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None));
      canvas.drawVertices(verts, BlendMode.Modulate, paint);
    }
    if (part.backIndices.length) {
      const backColors = part.shade.map((s) => Float32Array.of(BACK[0] * s, BACK[1] * s, BACK[2] * s, 1));
      const verts = Skia.MakeVertices(VertexMode.Triangles, part.positions, null, backColors, part.backIndices);
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setAlphaf(opacity);
      paint.setColor(Skia.Color('white'));
      canvas.drawVertices(verts, BlendMode.Modulate, paint);
    }
  };
  draw(mesh.body, 1);
  const lifted = Math.max(pose.pull * 0.6, pose.tear) * (1 - pose.fly);
  shadow(mesh.stub, TEAR_MESH.stubRows, lifted * 0.8, 6, 12);
  draw(mesh.stub, mesh.stubOpacity);
  return recorder.finishRecordingAsPicture();
}

export function TearMeshFlight(p: MeshFlightProps & { canvasWidth: number; canvasHeight: number }) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  useEffect(() => {
    let frame = 0;
    let alive = true;
    const start = Date.now();
    // A tick as the paper comes up, then light ticks along the rip.
    const ripAt = TEAR_STEPS.lift + TEAR_STEPS.pull + TEAR_STEPS.hold;
    const ticks = [
      setTimeout(impactTick, ripAt - TEAR_STEPS.hold - 20),
      ...[0, 1, 2].map((i) => setTimeout(impactTick, ripAt + (i * TEAR_STEPS.tear) / 3 + 40)),
    ];
    const tick = () => {
      if (!alive) return;
      const ms = Date.now() - start;
      if (ms >= TEAR_TOTAL_MS) {
        alive = false;
        p.onDone();
        return;
      }
      try {
        setPicture(recordTearFrame(p, ms));
      } catch {
        // A drawing error ends the tear; the save itself already happened.
        alive = false;
        p.onDone();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ticks.forEach(clearTimeout);
    };
    // One run per flight; the host keys this by flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {picture ? <Picture picture={picture} /> : null}
    </Canvas>
  );
}

/** A picture of a view, for the tear to bend. */
export function snapshotView(ref: Parameters<typeof makeImageFromView>[0]): Promise<SkImage | null> {
  return makeImageFromView(ref);
}
