import { BlurStyle, PaintStyle, Picture, Skia, StrokeCap, StrokeJoin, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { PULSE, pulseWindow } from './pulse';
import type { RoutePulse } from './routeLayer';

/** Redraw rate for the pulse; slow motion doesn't need 60 fps. */
export const PULSE_FRAME_MS = 33;

/**
 * Records one frame of every leg's pulse as a Skia Picture: the leg's path trimmed to the bright
 * stretch from pulse.ts, in soft white. Same imperative calls as the route layer (no Reanimated).
 */
export function recordPulseFrame(pulses: readonly RoutePulse[], ms: number, width: number, height: number): SkPicture | null {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  let drew = false;
  for (const p of pulses) {
    const w = pulseWindow(ms, p.legIndex, p.legCount);
    if (w.end <= w.start) continue;
    const piece = Skia.Path.Trim(p.path, w.start, w.end, false);
    if (!piece) continue;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(p.width + 1);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setColor(Skia.Color(`rgba(255,255,255,${p.selected ? PULSE.selectedAlpha : PULSE.otherAlpha})`));
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Solid, PULSE.blur, true));
    canvas.drawPath(piece, paint);
    drew = true;
  }
  const picture = recorder.finishRecordingAsPicture();
  return drew ? picture : null;
}

/**
 * The slow pulse that runs along each route line toward its destination (John, 2026-11-01).
 * Its own small component with its own timer, so only this layer redraws each frame. The caller
 * leaves it out with Reduce Motion and while the globe moves.
 */
export function RoutePulses({ pulses, width, height }: { pulses: readonly RoutePulse[]; width: number; height: number }) {
  const [picture, setPicture] = useState<SkPicture | null>(null);
  useEffect(() => {
    let frame = 0;
    let last = 0;
    let alive = true;
    const tick = (t: number) => {
      if (!alive) return;
      if (t - last >= PULSE_FRAME_MS) {
        last = t;
        try {
          setPicture(recordPulseFrame(pulses, Date.now(), width, height));
        } catch {
          // A drawing error must never take the map down; the routes still show without the pulse.
          alive = false;
          setPicture(null);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [pulses, width, height]);
  return picture ? <Picture picture={picture} /> : null;
}
