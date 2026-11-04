import {
  BlendMode,
  BlurStyle,
  Canvas,
  FilterMode,
  MipmapMode,
  PaintStyle,
  StrokeCap,
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
import {
  hash01,
  poseAt,
  stepDrive,
  TEAR_MESH,
  TEAR_TOTAL_MS,
  tearMesh,
  ticksCrossed,
  type MeshPart,
  type TearDrive,
  type TearGeometry,
} from './tearMesh';

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
  /** Swipe to save (round 133): your finger drives the tear; without it the tear plays by itself. */
  drive?: TearDrive;
  /** The paper laid back down after a swipe let go too soon. */
  onCancel?: () => void;
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
  p: Omit<MeshFlightProps, 'onDone' | 'onCancel' | 'drive'> & { canvasWidth: number; canvasHeight: number },
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
  // The torn edge's paper fibres (round 135, John: "like if I had cut paper with a dull knife"): a pale
  // fuzzy rim where the paper's core shows, with little hairs sticking out, once each stretch lets go.
  const fibres = (part: MeshPart, rows: number, top: boolean, opacity: number) => {
    const w = TEAR_MESH.cols + 1;
    const edge = top ? 0 : rows * w;
    const inward = top ? w : (rows - 1) * w;
    const rim = Skia.PathBuilder.Make();
    const hairs = Skia.PathBuilder.Make();
    let open = false;
    for (let i = 0; i <= TEAR_MESH.cols; i++) {
      const torn = mesh.edgeTorn[i];
      const p0 = part.positions[edge + i];
      if (torn < 0.05) {
        open = false;
        continue;
      }
      if (!open) rim.moveTo(p0.x, p0.y);
      else rim.lineTo(p0.x, p0.y);
      open = true;
      // A hair out from the edge, away from the paper, on about half the columns.
      const h = hash01(i * 3 + (top ? 1 : 2));
      if (h > 0.45) {
        const a = part.positions[edge + Math.max(0, i - 1)];
        const b = part.positions[edge + Math.min(TEAR_MESH.cols, i + 1)];
        const q = part.positions[inward + i];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        if (nx * (q.x - p0.x) + ny * (q.y - p0.y) > 0) {
          nx = -nx;
          ny = -ny;
        }
        const len = (0.8 + 2.2 * hash01(i * 7 + 5)) * torn;
        const lean = (hash01(i * 11 + 3) - 0.5) * 1.2;
        hairs.moveTo(p0.x, p0.y);
        hairs.lineTo(p0.x + nx * len + ny * lean, p0.y + ny * len - nx * lean);
      }
    }
    const rimPath = rim.build();
    const hairPath = hairs.build();
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 0.5, true));
    // A faint grey shadow first, so the fuzz shows on white paper, then the pale torn core on top,
    // so it shows on dark paper too.
    const pen = (rgb: string, alpha: number, width: number, path: typeof rimPath) => {
      paint.setColor(Skia.Color(`rgba(${rgb},${(alpha * opacity).toFixed(3)})`));
      paint.setStrokeWidth(width);
      canvas.drawPath(path, paint);
    };
    pen('20,30,45', 0.2, 2.4, rimPath);
    pen('252,250,242', 0.9, 1.3, rimPath);
    pen('20,30,45', 0.3, 0.9, hairPath);
    pen('252,250,242', 0.75, 0.5, hairPath);
  };
  draw(mesh.body, 1);
  fibres(mesh.body, TEAR_MESH.bodyRows, true, 1);
  const lifted = Math.max(pose.pull * 0.6, pose.tear) * (1 - pose.fly);
  shadow(mesh.stub, TEAR_MESH.stubRows, lifted * 0.8, 6, 12);
  draw(mesh.stub, mesh.stubOpacity);
  fibres(mesh.stub, TEAR_MESH.stubRows, false, mesh.stubOpacity);
  return recorder.finishRecordingAsPicture();
}

export function TearMeshFlight(p: MeshFlightProps & { canvasWidth: number; canvasHeight: number }) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  useEffect(() => {
    let frame = 0;
    let alive = true;
    let last = Date.now();
    // Swiping starts where the finger already has the paper; a played tear starts at the start.
    let ms = p.drive?.mode === 'drag' ? 0 : (p.drive?.target ?? 0);
    const tick = () => {
      if (!alive) return;
      const now = Date.now();
      const next = stepDrive(ms, p.drive, now - last);
      last = now;
      // A tick as the paper comes up taut, then light ticks along the rip, wherever it's driven from.
      for (let i = ticksCrossed(ms, next); i > 0; i--) impactTick();
      ms = next;
      if (ms >= TEAR_TOTAL_MS) {
        alive = false;
        p.onDone();
        return;
      }
      if (p.drive?.mode === 'cancel' && ms <= 0) {
        alive = false;
        (p.onCancel ?? p.onDone)();
        return;
      }
      try {
        setPicture(recordTearFrame(p, ms));
      } catch {
        // A drawing error ends the tear; the save itself already happened (or never will).
        alive = false;
        (p.drive?.mode === 'drag' || p.drive?.mode === 'cancel' ? (p.onCancel ?? p.onDone) : p.onDone)();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
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
