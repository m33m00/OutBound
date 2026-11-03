import { type ComponentRef, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, useColors } from '@/theme';

import { impactTick } from './haptics';
import { useReducedMotion } from './useReducedMotion';

/** Where on screen the tear starts, in window points. */
export interface TearFrom {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TearTicket {
  title: string;
  sub?: string;
}

type Launch = (from: TearFrom, ticket: TearTicket) => void;

const TearAwayContext = createContext<Launch | null>(null);

/** Starts the save animation, or null where no screen hosts it. */
export function useTearAway(): Launch | null {
  return useContext(TearAwayContext);
}

/** The little ticket's size: the pass, then the stub past its perforation. */
export const TICKET_W = 132;
export const STUB_W = 30;
const TICKET_H = 52;
const NOTCH = 5;
/** The tear, then the flight to My Trips: well under a second in all (round 125). */
export const TEAR_MS = 200;
export const FLY_MS = 460;

interface Flight {
  id: number;
  x: number;
  y: number;
  toX: number;
  toY: number;
  ticket: TearTicket;
}

/**
 * Saving a route tears a little ticket off (round 125, John: "A cute animation of tearing a ticket of
 * a flight you save onto your trips"): a mini pass pops out at Save, its stub tears off along the
 * dashed line and drops away, and the pass flies down into My Trips, shrinking as it goes. Drawn over
 * the screen and ignores touches. With Reduce Motion on there is no flight; Save's own tap says it.
 */
export function TearAwayHost({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const host = useRef<ComponentRef<typeof View>>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [flight, setFlight] = useState<Flight | null>(null);
  const seq = useRef(0);

  const launch = useCallback<Launch>(
    (from, ticket) => {
      if (reduceMotion || frame.width === 0) return;
      seq.current += 1;
      // Start centred under Save, in the host's own points; end at the bottom middle, where My Trips
      // sits in the tab bar (the third of five tabs).
      const x = Math.min(Math.max(8, from.x - frame.x + from.width / 2 - TICKET_W / 2), frame.width - TICKET_W - 8);
      const y = from.y - frame.y + from.height;
      setFlight({
        id: seq.current,
        x,
        y,
        toX: frame.width / 2 - TICKET_W / 2,
        toY: frame.height + 12,
        ticket,
      });
    },
    [reduceMotion, frame],
  );

  return (
    <TearAwayContext.Provider value={launch}>
      {children}
      {/* A layer over the whole screen that never takes a touch; the ticket flies on it. */}
      <View
        ref={host}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={() => host.current?.measureInWindow((x, y, width, height) => setFrame({ x, y, width, height }))}
        testID="tear-away-layer">
        {flight ? <FlyingTicket key={flight.id} flight={flight} onDone={() => setFlight(null)} /> : null}
      </View>
    </TearAwayContext.Provider>
  );
}

function FlyingTicket({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const c = useColors();
  const pop = useRef(new Animated.Value(0)).current;
  const tear = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 120, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(tear, { toValue: 1, duration: TEAR_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(fly, { toValue: 1, duration: FLY_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start(() => onDone());
    // A light tick as the stub rips.
    const t = setTimeout(impactTick, 120);
    return () => {
      clearTimeout(t);
      run.stop();
    };
    // One run per flight; the host keys this by flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dx = flight.toX - flight.x;
  const dy = flight.toY - flight.y;
  const pass = {
    opacity: fly.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
    transform: [
      { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      // A small lift before it drops, so it arcs.
      { translateY: fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, -18, dy] }) },
      {
        scale: Animated.multiply(
          pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        ),
      },
      { rotate: tear.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] }) },
    ],
  };
  const stub = {
    opacity: tear.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: tear.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
      { translateY: tear.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) },
      { rotate: tear.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '16deg'] }) },
    ],
  };
  const paper = { backgroundColor: c.surface, borderColor: c.line2 };
  const bite = { backgroundColor: c.bg, borderColor: c.line2 };
  return (
    <View pointerEvents="none" style={[styles.flight, { left: flight.x, top: flight.y }]} testID="tear-away">
      <Animated.View style={[styles.ticket, { opacity: pop }]}>
        <Animated.View
          style={[styles.pass, styles.above, paper, styles.shadow, { shadowColor: c.text }, pass]}
          testID="tear-pass">
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {flight.ticket.title}
          </Text>
          {flight.ticket.sub ? (
            <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
              {flight.ticket.sub}
            </Text>
          ) : null}
          <View style={[styles.biteTop, bite]} />
          <View style={[styles.biteBottom, bite]} />
        </Animated.View>
        <Animated.View style={[styles.stub, paper, stub]} testID="tear-stub">
          <View style={[styles.perf, { borderColor: c.line2 }]} />
          <View style={[styles.stubBar, { backgroundColor: c.accent }]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flight: { position: 'absolute', width: TICKET_W, height: TICKET_H, zIndex: 50, elevation: 50 },
  ticket: { flexDirection: 'row', width: TICKET_W, height: TICKET_H },
  pass: {
    width: TICKET_W - STUB_W,
    height: TICKET_H,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    borderTopLeftRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    paddingHorizontal: 10,
    justifyContent: 'center',
    gap: 1,
  },
  above: { zIndex: 2 },
  shadow: { shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, letterSpacing: -0.2 },
  sub: { fontFamily: fonts.monoMedium, fontSize: 10, lineHeight: 13 },
  // Half-circle notches at the perforation, top and bottom.
  biteTop: {
    position: 'absolute',
    right: -NOTCH,
    top: -NOTCH - StyleSheet.hairlineWidth,
    width: NOTCH * 2,
    height: NOTCH * 2,
    borderRadius: NOTCH,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  biteBottom: {
    position: 'absolute',
    right: -NOTCH,
    bottom: -NOTCH - StyleSheet.hairlineWidth,
    width: NOTCH * 2,
    height: NOTCH * 2,
    borderRadius: NOTCH,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  stub: {
    width: STUB_W,
    height: TICKET_H,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perf: { position: 'absolute', left: 0, top: NOTCH + 2, bottom: NOTCH + 2, borderLeftWidth: 1, borderStyle: 'dashed' },
  stubBar: { width: 4, height: 22, borderRadius: 2, opacity: 0.8 },
});
