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

/** A little wobble, the rip, the flight into My Trips, and the header settling back: under a second. */
export const WOBBLE_MS = 150;
export const TEAR_MS = 150;
export const FLY_MS = 420;
export const SETTLE_MS = 220;
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
 * wobbles, rips along the dashed line with a light haptic, and arcs down into My Trips, shrinking as it
 * goes; then the header settles back onto the card so the screen isn't left broken. Drawn over the
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
  const wobble = useRef(new Animated.Value(0)).current;
  const tear = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let finished = false;
    const run = Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: WOBBLE_MS, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(tear, { toValue: 1, duration: TEAR_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(fly, { toValue: 1, duration: FLY_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start(() => {
      finished = true;
      onDone();
    });
    // A light tick as it rips.
    const t = setTimeout(impactTick, WOBBLE_MS);
    return () => {
      clearTimeout(t);
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
  const motion = {
    opacity: fly.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      {
        // It lifts a hair as it rips, rises a little more, then drops into the tab bar: an arc.
        translateY: Animated.add(
          tear.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
          fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -14, dy] }),
        ),
      },
      { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
      {
        rotate: wobble.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: ['0deg', '-1.2deg', '1.2deg', '-0.6deg', '0deg'],
        }),
      },
      { rotate: tear.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) },
    ],
  };
  const step = TOOTH * Math.SQRT2;
  const teeth = Math.ceil(width / step) + 2;
  return (
    <Animated.View style={[styles.flight, { left: x, top: y, width, height, shadowColor: '#000' }, motion]} testID="tear-away">
      <View
        style={[styles.paper, { backgroundColor: source.paper, borderColor: source.edge, borderWidth: source.edgeWidth }]}
        testID="tear-piece">
        <TearCopyContext.Provider value={true}>{flight.piece}</TearCopyContext.Provider>
      </View>
      {/* The ragged edge where it tore along the perforation. */}
      <View style={[styles.teeth, { left: source.edgeWidth, right: source.edgeWidth }]} testID="tear-edge">
        {Array.from({ length: teeth }, (_, i) => (
          <View key={i} style={[styles.tooth, { left: i * step - TOOTH / 2, backgroundColor: source.paper }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flight: {
    position: 'absolute',
    zIndex: 50,
    elevation: 50,
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
