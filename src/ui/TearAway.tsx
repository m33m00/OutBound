import { type ComponentRef, createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { radius } from '@/theme';

import { impactTick } from './haptics';
import { useReducedMotion } from './useReducedMotion';

/**
 * The part of a card that tears off when you save it (round 126, John: "Can you have it actually
 * tear off the perforated line on the flight card"). The route card's header gives one: where it is
 * on screen, a copy of itself to fly, and a value that hides the real one while the copy is away.
 */
export interface TearSource {
  /** Where the header (the part that tears off) is on screen. */
  measure: (done: (x: number, y: number, width: number, height: number) => void) => void;
  /** Where the whole card is, inside its edge (round 129: the whole card bends in your hands). */
  measureCard: (done: (x: number, y: number, width: number, height: number) => void) => void;
  /** A copy of the header, drawn on the flying layer. */
  piece: () => ReactNode;
  /** A copy of the rest of the card under the perforation. */
  body: () => ReactNode;
  /** 1 while the real header shows; it hides when the torn copy lands, then eases back to 1. */
  hold: Animated.Value;
  /** 1 while the real card shows; 0 while its copy bends and tears on the flying layer. */
  cardHold: Animated.Value;
  /** The header's paper, the body's paper and the card's edge, so the copy looks like that card. */
  paper: string;
  bodyPaper: string;
  edge: string;
  edgeWidth: number;
}

const TearSourceContext = createContext<TearSource | null>(null);
/** Wraps the part of a card that can tear off. */
export const TearSourceProvider = TearSourceContext.Provider;
export function useTearSource(): TearSource | null {
  return useContext(TearSourceContext);
}

/** True inside the flying copy, so a piece can draw itself as already saved. */
const TearCopyContext = createContext(false);
export function useIsTearCopy(): boolean {
  return useContext(TearCopyContext);
}

type Launch = (source: TearSource) => void;
const TearAwayContext = createContext<Launch | null>(null);

/** Starts the tear, or null where no screen hosts it. */
export function useTearAway(): Launch | null {
  return useContext(TearAwayContext);
}

/**
 * The card is picked up, the stub above the perforation is pulled back toward you on a curve (rounds
 * 130 and 131), then torn off on a diagonal: the rip starts at the right notch and zips left along the
 * perforation while the stub swings up and out to the right, the rest of the card giving a small tug
 * back. The free stub flies into My Trips and the header settles back onto the card (round 131, John:
 * "Pulling back my direction and tearing it horizontally or at a diagonal"). About 1.5s in all.
 */
export const LIFT_MS = 160;
/** The pull toward you. */
export const CURL_MS = 340;
export const HOLD_MS = 60;
export const RIP_MS = 380;
export const FLY_MS = 420;
export const SETTLE_MS = 200;
/** Each slice of the curl sees the scene from this close, so the curl has depth. */
export const PERSPECTIVE = 600;
/** The pick-up: a small lift, the top tipped toward you and turned a little so the pull's side shows. */
const LIFT_SCALE = 1.03;
const LIFT_TILT_X = -6;
const LIFT_TILT_Y = -10;
/** The stub grows a little as it comes toward you. */
export const PULL_SCALE = 1.06;
/** The part of the rip spent zipping along the line; after it the stub is free and swings away. */
export const ZIP_PART = 0.75;
/** How far the stub has turned (counterclockwise, its right end up) when the zip ends, and once free. */
export const ZIP_DEG = 6;
export const FREE_DEG = 16;
/** Where the free stub swings to: up and out to the right. */
const FREE_X = 26;
const FREE_Y = -30;
/** Light ticks along the rip, like paper giving at each hole. */
const RIP_TICKS = 3;
/** The torn edge: small paper teeth hanging under the stub, each the lower half of a turned square. */
const TOOTH = 6;
const TOOTH_H = (TOOTH * Math.SQRT2) / 2;

/**
 * The curl (round 130): the stub is cut into thin slices across, each hinged on the one below it, and
 * each bends a little more than the last. The total turn up the stub follows an exponential, so near the
 * perforation the paper stays almost flat and it curves harder and harder toward the free edge, like the
 * graph of e^x on its side. Since round 131 it curls toward you (a negative turn lifts the top out of
 * the screen), the way paper comes up when you pull it back with your thumb.
 */
export const CURL_SLICES = 14;
export const CURL_TOTAL_DEG = -64;
export const CURL_GROWTH = 2.4;

/** How far the paper has turned at a point a fraction `at` of the way up the stub (0 at the line). */
export function curlTurn(at: number, total = CURL_TOTAL_DEG, growth = CURL_GROWTH): number {
  return (total * (Math.exp(growth * at) - 1)) / (Math.exp(growth) - 1);
}

/** Points of the curl's timeline that each slice's motion is sampled at. */
const CURL_STEPS = Array.from({ length: 11 }, (_, i) => i / 10);

export interface SlicePose {
  /** How far the slice has turned back, in degrees. */
  turn: number;
  /** Where its bottom edge lands and how big it looks, seen from in front of the card's middle. */
  shift: number;
  scale: number;
  /** How deep its bottom edge sits, for its own perspective. */
  depth: number;
}

/**
 * Where every slice of the stub sits at a point `t` of the curl, worked out in one shared 3D space: the
 * stub climbs from the perforation, each slice tilted back by the curl so far, and each is then seen
 * from `perspective` in front of the card's middle (`centerY`, from the stub's top). Laying the slices
 * out this way, side by side, keeps the curve true; views nested inside each other flatten at every level
 * and lose it.
 */
export function slicePoses(t: number, height: number, centerY: number, perspective = PERSPECTIVE): SlicePose[] {
  const n = CURL_SLICES;
  const h = height / n;
  const out: SlicePose[] = [];
  let y = height;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const turn = t * curlTurn((i + 1) / n);
    const scale = perspective / (perspective + z);
    out.push({ turn, shift: centerY + (y - centerY) * scale - (height - i * h), scale, depth: z });
    const a = (turn * Math.PI) / 180;
    y -= h * Math.cos(a);
    z += h * Math.sin(a);
  }
  return out;
}

/** Each slice's own bend, bottom (at the perforation) to top (the free edge). */
export function curlAngles(slices = CURL_SLICES, total = CURL_TOTAL_DEG, growth = CURL_GROWTH): number[] {
  return Array.from(
    { length: slices },
    (_, i) => curlTurn((i + 1) / slices, total, growth) - curlTurn(i / slices, total, growth),
  );
}

interface Flight {
  id: number;
  /** The whole card in the host, edge included. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The top's height: the header down to the perforation, edge included. */
  topHeight: number;
  /** Where the top's middle ends up: the My Trips tab, just under the screen's bottom middle. */
  toX: number;
  toY: number;
  source: TearSource;
  piece: ReactNode;
  body: ReactNode;
}

/**
 * Saving a route tears the route card's header off along its perforation (round 126, John): you pull the
 * header toward you, it rips from the right notch to the left and swings free on a diagonal (round 131),
 * and arcs down into My Trips, shrinking as it goes; then the header settles back onto the card so the
 * screen isn't left broken. Drawn over the
 * screen on a layer that never takes a touch. With Reduce Motion on nothing moves; Save's own tap says it.
 */
export function TearAwayHost({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const host = useRef<ComponentRef<typeof View>>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [flight, setFlight] = useState<Flight | null>(null);
  const flying = useRef(false);
  const seq = useRef(0);

  const launch = useCallback<Launch>(
    (source) => {
      if (reduceMotion || frame.width === 0 || flying.current) return;
      source.measureCard((cx, cy, cw, ch) => {
        source.measure((hx, hy, hw, hh) => {
          if (!cw || !ch || !hw || !hh || flying.current) return;
          flying.current = true;
          seq.current += 1;
          const e = source.edgeWidth;
          const x = cx - frame.x - e;
          const y = cy - frame.y - e;
          const topHeight = Math.min(ch, hy + hh - cy) + e;
          source.cardHold.setValue(0);
          setFlight({
            id: seq.current,
            x,
            y,
            width: cw + e * 2,
            height: ch + e * 2,
            topHeight,
            toX: frame.width / 2,
            toY: frame.height + 10,
            source,
            piece: source.piece(),
            body: source.body(),
          });
        });
      });
    },
    [reduceMotion, frame],
  );

  const landed = useCallback((source: TearSource) => {
    flying.current = false;
    // The card comes back without its header, which then settles back on with a small bounce.
    source.hold.setValue(0);
    source.cardHold.setValue(1);
    setFlight(null);
    Animated.timing(source.hold, {
      toValue: 1,
      duration: SETTLE_MS,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <TearAwayContext.Provider value={launch}>
      {children}
      {/* A layer over the whole screen that never takes a touch; the torn piece flies on it. */}
      <View
        ref={host}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={() => host.current?.measureInWindow((x, y, width, height) => setFrame({ x, y, width, height }))}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="tear-away-layer">
        {flight ? <FlyingPiece key={flight.id} flight={flight} onDone={() => landed(flight.source)} /> : null}
      </View>
    </TearAwayContext.Provider>
  );
}

function FlyingPiece({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const lift = useRef(new Animated.Value(0)).current;
  const curl = useRef(new Animated.Value(0)).current;
  const rip = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let finished = false;
    const timing = (v: Animated.Value, duration: number, easing: (t: number) => number) =>
      Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true });
    const run = Animated.sequence([
      timing(lift, LIFT_MS, Easing.out(Easing.quad)),
      // The pull comes up slowly, then fast: exponential easing.
      timing(curl, CURL_MS, Easing.in(Easing.exp)),
      // Held for a beat before it gives.
      Animated.delay(HOLD_MS),
      timing(rip, RIP_MS, Easing.inOut(Easing.quad)),
      timing(fly, FLY_MS, Easing.in(Easing.cubic)),
    ]);
    run.start(() => {
      finished = true;
      onDone();
    });
    // A tick as it comes up, then light ticks along the rip.
    const ripAt = LIFT_MS + CURL_MS + HOLD_MS;
    const ticks = [
      setTimeout(impactTick, LIFT_MS + CURL_MS - 30),
      ...Array.from({ length: RIP_TICKS }, (_, i) => setTimeout(impactTick, ripAt + (i * RIP_MS * ZIP_PART) / RIP_TICKS + 40)),
    ];
    return () => {
      ticks.forEach(clearTimeout);
      run.stop();
      // Never leave the screen without its card.
      if (!finished) {
        flight.source.cardHold.setValue(1);
        flight.source.hold.setValue(1);
      }
    };
    // One run per flight; the host keys this by flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { x, y, width, height, topHeight, toX, toY, source } = flight;
  const clamp = 'clamp' as const;
  // Picked up, then laid back down as the top flies off.
  const held = Animated.subtract(lift, fly);
  const cardMotion = {
    transform: [
      { perspective: PERSPECTIVE * 1.6 },
      { scale: held.interpolate({ inputRange: [0, 1], outputRange: [1, LIFT_SCALE], extrapolate: clamp }) },
      { rotateX: held.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${LIFT_TILT_X}deg`], extrapolate: clamp }) },
      { rotateY: held.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${LIFT_TILT_Y}deg`], extrapolate: clamp }) },
    ],
  };
  // The tear, hinged at the bottom left where it's still attached: the rip starts at the right notch, so
  // the right end comes up first; once it's free the stub swings up and out to the right. It grows a
  // little as you pull it toward you.
  const tearMotion = {
    transformOrigin: 'left bottom',
    transform: [
      { translateX: rip.interpolate({ inputRange: [0, ZIP_PART, 1], outputRange: [0, 4, FREE_X] }) },
      { translateY: rip.interpolate({ inputRange: [0, ZIP_PART, 1], outputRange: [0, -6, FREE_Y] }) },
      {
        rotate: rip.interpolate({ inputRange: [0, ZIP_PART, 1], outputRange: ['0deg', `-${ZIP_DEG}deg`, `-${FREE_DEG}deg`] }),
      },
      { scale: curl.interpolate({ inputRange: [0, 1], outputRange: [1, PULL_SCALE] }) },
    ],
  };
  // The rest of the card gives a small tug back the other way while the rip runs.
  const tugMotion = {
    transformOrigin: 'left top',
    transform: [
      { translateY: rip.interpolate({ inputRange: [0, 0.4, ZIP_PART, 1], outputRange: [0, 3, 2, 0] }) },
      { rotate: rip.interpolate({ inputRange: [0, 0.4, ZIP_PART, 1], outputRange: ['0deg', '0.6deg', '0.4deg', '0deg'] }) },
    ],
  };
  // The lifted stub's soft shadow on the card under it, gone once it's torn away.
  const shadow = Animated.multiply(curl, rip.interpolate({ inputRange: [0, ZIP_PART, 1], outputRange: [1, 0.7, 0] }));
  // The flight: an arc down into My Trips, shrinking and fading at the end.
  const dx = toX - (x + width / 2);
  const dy = toY - (y + topHeight / 2);
  const flyMotion = {
    opacity: fly.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -14, dy] }) },
      { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
    ],
  };
  const edge = { borderColor: source.edge, borderWidth: source.edgeWidth };
  const step = TOOTH * Math.SQRT2;
  const teeth = Math.ceil(width / step) + 2;
  return (
    <Animated.View style={[styles.card, { left: x, top: y, width, height, shadowColor: '#000' }, cardMotion]} testID="tear-away">
      {/* The rest of the card, under the perforation, stays in your hand. */}
      <Animated.View style={[styles.half, { top: topHeight, bottom: 0 }, tugMotion]} testID="tear-bottom">
        <View style={[styles.bottomPaper, edge, { backgroundColor: source.bodyPaper }]}>{flight.body}</View>
        {/* A soft shadow in three bands, darkest at the line. */}
        {[0.14, 0.08, 0.035].map((o, i) => (
          <Animated.View
            key={i}
            style={[styles.shadowBand, { top: i * 4, opacity: Animated.multiply(shadow, o) }]}
            testID="tear-shadow"
          />
        ))}
      </Animated.View>
      {/* The stub, which is pulled toward you, tears off and flies. */}
      <Animated.View style={[styles.half, { top: 0, height: topHeight }, flyMotion]}>
        <Animated.View style={[styles.fill, tearMotion]} testID="tear-rip">
          <Curl
            curl={curl}
            height={topHeight}
            centerY={height / 2}
            back={source.paper}
            paper={
              <View style={[styles.topPaper, edge, { backgroundColor: source.paper, height: topHeight }]} testID="tear-piece">
                <TearCopyContext.Provider value={true}>{flight.piece}</TearCopyContext.Provider>
              </View>
            }>
            {/* The ragged edge shows hole by hole as the rip runs from the right notch to the left. */}
            <View style={[styles.teeth, { left: source.edgeWidth, right: source.edgeWidth }]} testID="tear-edge">
              {Array.from({ length: teeth }, (_, i) => {
                const at = ZIP_PART * Math.max(0, 1 - i / teeth);
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.tooth,
                      {
                        left: i * step - TOOTH / 2,
                        backgroundColor: source.paper,
                        opacity: rip.interpolate({
                          inputRange: [Math.max(0, at - 0.06), Math.max(0.001, at)],
                          outputRange: [0, 1],
                          extrapolate: clamp,
                        }),
                      },
                    ]}
                  />
                );
              })}
            </View>
          </Curl>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The stub as thin slices across, laid side by side and each moved to its place on the curve (round 130),
 * so together they curve toward you: almost flat at the perforation, curling harder toward the free edge. Every
 * slice shows its own band of the same paper and darkens as it turns from the light; once a slice turns
 * past upright you see the plain back of the paper. `children` sit on the bottom slice, at the line.
 */
function Curl({
  curl,
  height,
  centerY,
  paper,
  back,
  children,
}: {
  curl: Animated.Value;
  height: number;
  centerY: number;
  paper: ReactNode;
  back: string;
  children?: ReactNode;
}) {
  const n = CURL_SLICES;
  const slice = height / n;
  const poses = CURL_STEPS.map((t) => slicePoses(t, height, centerY));
  const full = poses[poses.length - 1];
  return (
    <View style={styles.fill}>
      {Array.from({ length: n }, (_, i) => {
        const at = (k: keyof SlicePose) => poses.map((p) => p[i][k]);
        const turned = curlTurn((i + 1) / n) / CURL_TOTAL_DEG;
        // The point of the curl where this slice stands upright, after which its back shows.
        const upright = Math.abs(full[i].turn) > 90 ? 90 / Math.abs(full[i].turn) : null;
        const overlap = i === n - 1 ? 0 : 0.75;
        return (
          <Animated.View
            key={i}
            style={[
              styles.slice,
              {
                top: height - (i + 1) * slice,
                height: slice,
                transformOrigin: 'center bottom',
                transform: [
                  { translateY: curl.interpolate({ inputRange: CURL_STEPS, outputRange: at('shift') }) },
                  { scale: curl.interpolate({ inputRange: CURL_STEPS, outputRange: at('scale') }) },
                  { perspective: PERSPECTIVE + full[i].depth },
                  {
                    rotateX: curl.interpolate({
                      inputRange: CURL_STEPS,
                      outputRange: at('turn').map((d) => `${d}deg`),
                    }),
                  },
                ],
              },
            ]}
            testID="curl-slice">
            {/* A hair taller than the slice so no seam shows between slices. */}
            <View style={[styles.sliceClip, { height: slice + overlap, top: -overlap, backgroundColor: back }]}>
              <Animated.View
                style={[
                  styles.slicePaper,
                  { top: -(height - (i + 1) * slice) + overlap },
                  upright != null
                    ? { opacity: curl.interpolate({ inputRange: [0, upright, upright + 0.001, 1], outputRange: [1, 1, 0, 0] }) }
                    : null,
                ]}>
                {paper}
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shade,
                  { opacity: curl.interpolate({ inputRange: [0, 1], outputRange: [0, 0.03 + 0.1 * Math.abs(turned)] }) },
                ]}
              />
            </View>
            {i === 0 ? children : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    zIndex: 50,
    elevation: 50,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  half: { position: 'absolute', left: 0, right: 0 },
  fill: { flex: 1 },
  topPaper: {
    overflow: 'hidden',
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  bottomPaper: {
    flex: 1,
    overflow: 'hidden',
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  shadowBand: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#000' },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' },
  // A darker band along the crease on each side of it.
  slice: { position: 'absolute', left: 0, right: 0 },
  sliceClip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  slicePaper: { position: 'absolute', left: 0, right: 0 },
  teeth: { position: 'absolute', bottom: -TOOTH_H, height: TOOTH_H, overflow: 'hidden' },
  tooth: { position: 'absolute', top: -TOOTH / 2, width: TOOTH, height: TOOTH, transform: [{ rotate: '45deg' }] },
});
