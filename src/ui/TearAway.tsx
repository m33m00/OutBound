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
  measure: (done: (x: number, y: number, width: number, height: number) => void) => void;
  /** A copy of the piece, drawn on the flying layer. */
  piece: () => ReactNode;
  /** 1 while the real piece shows; set to 0 while its copy flies, then eased back to 1. */
  hold: Animated.Value;
  /** The piece's paper and the card's edge, so the copy looks torn from that card. */
  paper: string;
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
 * The fold back at the perforation, a beat with it creased, the rip along the fold from left to right,
 * the flight into My Trips, and the header settling back (round 127, John: "pulling back the card and
 * tearing it horizontally"; round 128: "Bend it more", "Like bend it back and tear"). About 1.3s in all.
 */
export const PULL_MS = 280;
export const HOLD_MS = 120;
export const RIP_MS = 320;
export const FLY_MS = 400;
export const SETTLE_MS = 200;
/** How far the header folds back at the perforation (round 128: a real crease), how far it opens again
 * while it flies so you still see it, and how far its free end lifts as the rip runs. */
export const FOLD_DEG = 72;
const FLY_FOLD_DEG = 28;
const RIP_DEG = 4;
/** Light ticks along the rip, like paper giving at each hole. */
const RIP_TICKS = 3;
/** The torn edge: small paper teeth hanging under the piece, each the lower half of a turned square. */
const TOOTH = 6;
const TOOTH_H = (TOOTH * Math.SQRT2) / 2;

interface Flight {
  id: number;
  /** Where the piece sits in the host, edge included. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where its middle ends up: the My Trips tab, just under the screen's bottom middle. */
  toX: number;
  toY: number;
  source: TearSource;
  piece: ReactNode;
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
      source.measure((x, y, width, height) => {
        if (!width || !height || flying.current) return;
        flying.current = true;
        seq.current += 1;
        const e = source.edgeWidth;
        source.hold.setValue(0);
        setFlight({
          id: seq.current,
          x: x - frame.x - e,
          y: y - frame.y - e,
          width: width + e * 2,
          height: height + e,
          toX: frame.width / 2,
          toY: frame.height + 10,
          source,
          piece: source.piece(),
        });
      });
    },
    [reduceMotion, frame],
  );

  const landed = useCallback((source: TearSource) => {
    flying.current = false;
    setFlight(null);
    // The header settles back onto the card with a small bounce.
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
  const pull = useRef(new Animated.Value(0)).current;
  const rip = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let finished = false;
    const run = Animated.sequence([
      Animated.timing(pull, { toValue: 1, duration: PULL_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      // Held creased for a beat before it gives.
      Animated.delay(HOLD_MS),
      Animated.timing(rip, { toValue: 1, duration: RIP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(fly, { toValue: 1, duration: FLY_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start(() => {
      finished = true;
      onDone();
    });
    // Light ticks as the rip runs along the holes.
    // A tick as it creases, then light ticks along the rip.
    const ticks = [
      setTimeout(impactTick, PULL_MS - 30),
      ...Array.from({ length: RIP_TICKS }, (_, i) => setTimeout(impactTick, PULL_MS + HOLD_MS + (i * RIP_MS) / RIP_TICKS + 40)),
    ];
    return () => {
      ticks.forEach(clearTimeout);
      run.stop();
      // Never leave the card without its header.
      if (!finished) flight.source.hold.setValue(1);
    };
    // One run per flight; the host keys this by flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { x, y, width, height, toX, toY, source } = flight;
  const dx = toX - (x + width / 2);
  const dy = toY - (y + height / 2);
  // The flight: an arc down into My Trips, shrinking and fading at the end.
  const flyMotion = {
    opacity: fly.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -14, dy] }) },
      { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
    ],
  };
  // The tear, hinged at the bottom right where it's still attached: first the header folds hard back along
  // the perforation and holds there (round 128), then the rip runs left to right along the fold, lifting
  // the free left end as it goes; in flight it opens part way so the piece still reads as a ticket.
  const tearMotion = {
    transformOrigin: 'right bottom',
    transform: [
      { perspective: 700 },
      {
        rotateX: Animated.add(pull, Animated.multiply(fly, -(FOLD_DEG - FLY_FOLD_DEG) / FOLD_DEG)).interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${FOLD_DEG}deg`],
        }),
      },
      { rotate: rip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${RIP_DEG}deg`] }) },
      { translateY: Animated.add(pull, rip).interpolate({ inputRange: [0, 2], outputRange: [0, -4] }) },
    ],
  };
  const step = TOOTH * Math.SQRT2;
  const teeth = Math.ceil(width / step) + 2;
  return (
    <Animated.View style={[styles.flight, { left: x, top: y, width, height }, flyMotion]} testID="tear-away">
      <Animated.View style={[styles.tear, { shadowColor: '#000' }, tearMotion]} testID="tear-peel">
        <View
          style={[styles.paper, { backgroundColor: source.paper, borderColor: source.edge, borderWidth: source.edgeWidth }]}
          testID="tear-piece">
          <TearCopyContext.Provider value={true}>{flight.piece}</TearCopyContext.Provider>
          {/* Folded back, the paper turns from the light: a soft shade over it, easing as it flies. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#000',
                opacity: Animated.subtract(
                  pull.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }),
                  fly.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }),
                ),
              },
            ]}
            testID="tear-shade"
          />
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
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            );
          })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: { position: 'absolute', zIndex: 50, elevation: 50 },
  tear: {
    flex: 1,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  paper: {
    flex: 1,
    overflow: 'hidden',
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  teeth: { position: 'absolute', bottom: -TOOTH_H, height: TOOTH_H, overflow: 'hidden' },
  tooth: { position: 'absolute', top: -TOOTH / 2, width: TOOTH, height: TOOTH, transform: [{ rotate: '45deg' }] },
});
