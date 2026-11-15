/**
 * The paper on a results ticket (round 221): a faint paper grain all over, the stub under the perforation a
 * shade warmer, and a hairline sketch of where the ticket goes, pressed into the top right.
 *
 * John picked the paper grain look ("Something to do with the destination and option 2"), then the landmark
 * sketch ("Landmark sketch but a little more detailed?", "And different for each one subtly"), and asked for it
 * to move ("Sure lets go with this and can it be animated?"). So each airport has its own drawing, and it draws
 * itself in once, left to right, the first time that ticket shows, like the city coming into view. It doesn't
 * loop. With Reduce Motion on it just fades in.
 *
 * A US airport with no landmark of its own yet gets its state's outline with the airport circled. Anywhere else
 * the ticket keeps the grain alone.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { AIRPORTS, type Airport } from '@/engine';
import type { ColorScheme } from '@/theme';

import { LANDMARK_IMAGES, SKETCH_H, SKETCH_W, SKETCH_X0, SKETCH_Y0, STATE_FRAMES, STATE_IMAGES } from './sketchAssets';
import { useReduceMotionStatus } from '../map/useReduceMotion';

export { SKETCH_H, SKETCH_W };

/** How strong the sketch's ink is: light enough that the times and route always lead. */
export const SKETCH_INK = { light: 0.3, dark: 0.22 } as const;
/** How long the draw-in takes, and the fade that stands in for it with Reduce Motion on. */
export const DRAW_MS = 1100;
export const FADE_MS = 300;
/** The gap between the sketch and the perforation, and between it and the card's right edge. */
export const SKETCH_GAP = 4;
export const SKETCH_RIGHT = 8;

const GRAIN = {
  light: require('../../assets/images/grain-light.png'),
  dark: require('../../assets/images/grain-dark.png'),
} as const;

export type TicketSketch =
  | { kind: 'landmark'; image: number }
  | { kind: 'state'; image: number; dot: { x: number; y: number } }
  | null;

/** The drawing for a ticket to this airport: its landmark, else its state with the airport circled, else none. */
export function ticketSketch(code: string, airports: Readonly<Record<string, Airport>> = AIRPORTS): TicketSketch {
  const landmark = LANDMARK_IMAGES[code];
  if (landmark != null) return { kind: 'landmark', image: landmark };
  const a = airports[code];
  const region = a && (!a.country || a.country === 'US') ? a.region : undefined;
  const frame = region ? STATE_FRAMES[region] : undefined;
  const image = region ? STATE_IMAGES[region] : undefined;
  if (!a || !frame || image == null) return null;
  // Alaska's outline was drawn with the Aleutians brought across the date line.
  const lon = region === 'AK' && a.lon > 0 ? a.lon - 360 : a.lon;
  return {
    kind: 'state',
    image,
    dot: {
      x: (lon - frame.lonMin) * frame.k * frame.s + frame.ox - SKETCH_X0,
      y: (frame.latMax - a.lat) * frame.s + frame.oy - SKETCH_Y0,
    },
  };
}

// Tickets whose sketch has drawn in already this session, so scrolling back up doesn't draw it again.
const drawn = new Set<string>();

/** Test hook: forget which sketches have drawn. */
export function resetDrawnSketches() {
  drawn.clear();
}

/** The paper grain over a whole ticket, repeating. */
export function TicketGrain({ scheme }: { scheme: ColorScheme }) {
  return (
    <Image source={GRAIN[scheme]} resizeMode="repeat" style={StyleSheet.absoluteFill} accessible={false} testID="ticket-grain" />
  );
}

/**
 * The sketch in its box. `drawKey` names the ticket, so its draw-in happens once; `ink` is the text color and
 * `strength` scales the ink (a departed or arrived ticket's sketch is fainter, like the rest of it).
 */
export function TicketSketchArt({
  sketch,
  drawKey,
  ink,
  scheme,
  strength = 1,
}: {
  sketch: Exclude<TicketSketch, null>;
  drawKey: string;
  ink: string;
  scheme: ColorScheme;
  strength?: number;
}) {
  const { reduce, known } = useReduceMotionStatus();
  const already = drawn.has(drawKey);
  const p = useRef(new Animated.Value(already ? 1 : 0)).current;
  const started = useRef(already);
  useEffect(() => {
    // Wait until Reduce Motion is known, so a person who has it on never sees the draw-in.
    if (started.current || !known) return;
    started.current = true;
    drawn.add(drawKey);
    const anim = Animated.timing(
      p,
      reduce
        ? { toValue: 1, duration: FADE_MS, useNativeDriver: true }
        : { toValue: 1, duration: DRAW_MS, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true },
    );
    anim.start(({ finished }) => {
      if (!finished) p.setValue(1);
    });
    return () => anim.stop();
  }, [known, reduce, drawKey, p]);
  const opacity = SKETCH_INK[scheme] * strength;
  const art = (
    <>
      <Image source={sketch.image} style={[styles.art, { tintColor: ink }]} accessible={false} testID="ticket-sketch-art" />
      {sketch.kind === 'state' ? (
        <View
          style={[styles.ring, { left: sketch.dot.x - RING / 2, top: sketch.dot.y - RING / 2, borderColor: ink }]}
          testID="ticket-sketch-place">
          <View style={[styles.pin, { backgroundColor: ink }]} />
        </View>
      ) : null}
    </>
  );
  // With Reduce Motion the sketch fades in; otherwise a window slides open left to right over it, so the lines
  // appear as if drawn, and the art itself never moves.
  const wipe = reduce
    ? null
    : {
        clip: { transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-SKETCH_W, 0] }) }] },
        hold: { transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [SKETCH_W, 0] }) }] },
      };
  return (
    <View pointerEvents="none" style={[styles.box, { opacity }]} testID="ticket-sketch">
      <Animated.View
        style={[
          styles.fill,
          wipe?.clip,
          { opacity: reduce ? p : p.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }) },
        ]}>
        <Animated.View style={[styles.fill, wipe?.hold]}>{art}</Animated.View>
      </Animated.View>
    </View>
  );
}

const RING = 5.2;

const styles = StyleSheet.create({
  box: { width: SKETCH_W, height: SKETCH_H, overflow: 'hidden' },
  fill: { width: SKETCH_W, height: SKETCH_H, overflow: 'hidden' },
  art: { width: SKETCH_W, height: SKETCH_H },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 0.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: { width: 1.8, height: 1.8, borderRadius: 0.9 },
});
