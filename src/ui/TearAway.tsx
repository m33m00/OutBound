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
 * The card is picked up, bent back in your hands at the perforation, held creased for a beat, torn down
 * the crease from left to right, and the top flies into My Trips while the rest lies back flat; then the
 * header settles back onto the card (rounds 127 to 129, John: "bending back the whole card as if it's in
 * your hand and you're tearing it down the line"). About 1.4s in all.
 */
export const LIFT_MS = 160;
export const BEND_MS = 240;
export const HOLD_MS = 80;
export const RIP_MS = 280;
export const FLY_MS = 420;
export const SETTLE_MS = 200;
/**
 * Depth of the bend. The perspective is close (a small number) so the halves visibly narrow as they
 * turn away, like paper in your hands, rather than just squashing flat (round 129, John: "it folds in
 * like a 2D effect").
 */
export const PERSPECTIVE = 420;
export const TOP_BEND_DEG = 40;
export const BOTTOM_BEND_DEG = 34;
/** The pick-up: a small lift and tilt. */
const LIFT_SCALE = 1.03;
const LIFT_TILT_X = 6;
const LIFT_TILT_Y = -8;
/** How far the free left end of the top lifts as the rip runs. */
const RIP_DEG = 4;
/** Light ticks along the rip, like paper giving at each hole. */
const RIP_TICKS = 3;
/** The torn edge: small paper teeth hanging under the top, each the lower half of a turned square. */
const TOOTH = 6;
const TOOTH_H = (TOOTH * Math.SQRT2) / 2;

/**
 * How much narrower the far edge of a panel of this height looks when it turns this far away under this
 * perspective: 1 is flat, smaller reads as depth. The tests hold the bend to real foreshortening.
 */
export function farEdgeScale(height: number, deg: number, perspective = PERSPECTIVE): number {
  return perspective / (perspective + height * Math.sin((deg * Math.PI) / 180));
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
 * Saving a route tears the route card's header off along its perforation (round 126, John): the header
 * bends back at the dashed line, rips along it from left to right with light ticks (round 127), and arcs
 * down into My Trips, shrinking as it goes; then the header settles back onto the card so the screen
 * isn't left broken. Drawn over the
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
  const bend = useRef(new Animated.Value(0)).current;
  const rip = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let finished = false;
    const timing = (v: Animated.Value, duration: number, easing: (t: number) => number) =>
      Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true });
    const run = Animated.sequence([
      timing(lift, LIFT_MS, Easing.out(Easing.quad)),
      timing(bend, BEND_MS, Easing.inOut(Easing.cubic)),
      // Held creased for a beat before it gives.
      Animated.delay(HOLD_MS),
      timing(rip, RIP_MS, Easing.inOut(Easing.quad)),
      timing(fly, FLY_MS, Easing.in(Easing.cubic)),
    ]);
    run.start(() => {
      finished = true;
      onDone();
    });
    // A tick as it creases, then light ticks along the rip.
    const ripAt = LIFT_MS + BEND_MS + HOLD_MS;
    const ticks = [
      setTimeout(impactTick, LIFT_MS + BEND_MS - 30),
      ...Array.from({ length: RIP_TICKS }, (_, i) => setTimeout(impactTick, ripAt + (i * RIP_MS) / RIP_TICKS + 40)),
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
  // Both halves turn away from you around the perforation, like a card bent back in two hands. The rest
  // of the card lies back flat while the top flies; the top opens a little so it still reads as a ticket.
  const bottomBent = Animated.subtract(bend, fly);
  const bottomMotion = {
    transformOrigin: 'center top',
    transform: [
      { perspective: PERSPECTIVE },
      {
        rotateX: bottomBent.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `-${BOTTOM_BEND_DEG}deg`],
          extrapolate: clamp,
        }),
      },
    ],
  };
  const topBent = Animated.subtract(bend, Animated.multiply(fly, 0.4));
  const topMotion = {
    transformOrigin: 'center bottom',
    transform: [
      { perspective: PERSPECTIVE },
      { rotateX: topBent.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${TOP_BEND_DEG}deg`], extrapolate: clamp }) },
    ],
  };
  // The rip, hinged at the bottom right where it's still attached: the free left end lifts as it runs.
  const ripMotion = {
    transformOrigin: 'right bottom',
    transform: [{ rotate: rip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `-${RIP_DEG}deg`] }) }],
  };
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
  // Turned from the light, each face darkens, most at the crease.
  const shade = (most: number, fades: Animated.AnimatedSubtraction) =>
    fades.interpolate({ inputRange: [0, 1], outputRange: [0, most], extrapolate: clamp });
  const edge = { borderColor: source.edge, borderWidth: source.edgeWidth };
  const step = TOOTH * Math.SQRT2;
  const teeth = Math.ceil(width / step) + 2;
  return (
    <Animated.View style={[styles.card, { left: x, top: y, width, height, shadowColor: '#000' }, cardMotion]} testID="tear-away">
      {/* The rest of the card, under the perforation. */}
      <Animated.View style={[styles.half, { top: topHeight, bottom: 0 }, bottomMotion]} testID="tear-bottom">
        <View style={[styles.bottomPaper, edge, { backgroundColor: source.bodyPaper }]}>
          {flight.body}
          <Animated.View pointerEvents="none" style={[styles.shade, { opacity: shade(0.16, bottomBent) }]} />
          <Animated.View pointerEvents="none" style={[styles.creaseTop, { opacity: shade(0.22, bottomBent) }]} />
        </View>
      </Animated.View>
      {/* The top, which tears off and flies. */}
      <Animated.View style={[styles.half, { top: 0, height: topHeight }, flyMotion]}>
        <Animated.View style={[styles.fill, topMotion]} testID="tear-peel">
          <Animated.View style={[styles.fill, ripMotion]} testID="tear-rip">
            <View style={[styles.topPaper, edge, { backgroundColor: source.paper }]} testID="tear-piece">
              <TearCopyContext.Provider value={true}>{flight.piece}</TearCopyContext.Provider>
              <Animated.View pointerEvents="none" style={[styles.shade, { opacity: shade(0.22, topBent) }]} testID="tear-shade" />
              <Animated.View pointerEvents="none" style={[styles.creaseBottom, { opacity: shade(0.26, topBent) }]} />
            </View>
            {/* The ragged edge shows hole by hole as the rip runs from left to right. */}
            <View style={[styles.teeth, { left: source.edgeWidth, right: source.edgeWidth }]} testID="tear-edge">
              {Array.from({ length: teeth }, (_, i) => {
                const at = Math.min(1, i / teeth);
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.tooth,
                      {
                        left: i * step - TOOTH / 2,
                        backgroundColor: source.paper,
                        opacity: rip.interpolate({
                          inputRange: [Math.max(0, at - 0.08), Math.max(0.001, at)],
                          outputRange: [0, 1],
                          extrapolate: clamp,
                        }),
                      },
                    ]}
                  />
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
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
    flex: 1,
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
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' },
  // A darker band along the crease on each side of it.
  creaseBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, backgroundColor: '#000' },
  creaseTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 14, backgroundColor: '#000' },
  teeth: { position: 'absolute', bottom: -TOOTH_H, height: TOOTH_H, overflow: 'hidden' },
  tooth: { position: 'absolute', top: -TOOTH / 2, width: TOOTH, height: TOOTH, transform: [{ rotate: '45deg' }] },
});
