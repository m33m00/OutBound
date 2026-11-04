import { StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

import { AIRLINE_MARKS, AirlineMark } from './AirlinePill';

/** Room above the line for each leg's seat numbers, and below it for a stop's code. */
const LABEL_H = 16;
const DOT = 8;
/** Each stop's slot, centred on its dot, wide enough for a three-letter code. */
const STOP_W = 40;
/** Room above the seat numbers for a connection's flag ("At risk"), only when a route has one. */
const FLAG_H = 21;
/** The X on a canceled leg. */
const X_SIZE = 12;
/** Room under the stop codes for each leg's flight and aircraft (round 145). */
const FLIGHT_H = 40;
/** With this many legs or more, a known airline's flight shows its logo and number without the code, to fit. */
const COMPACT_LEGS = 3;

/** One leg of the line: the color it's drawn in and the seat numbers shown above it (round 140). */
export interface MiniRouteLeg {
  /** The line's color. */
  color: string;
  /** The numbers' color: the same hue, dark enough to read as small text. */
  text: string;
  label: string;
  /** Canceled: drawn red with an X in the middle (round 143, John). */
  canceled?: boolean;
  /**
   * A live word for this flight ("Delayed 50m"), in a pill centred over its own stretch of line (round 146,
   * John: "The delayed pill, can that be over on top of that route line ... centered on that route line").
   */
  flag?: string | null;
  /** The leg's flight, shown under its stretch of line (round 145, John). */
  flight?: { airline: string; number: string; aircraft?: string | null };
}

/**
 * A market at a glance on a result card (round 119, John picked the mini route line on
 * 2026-11-03; Clean styling since round 120): the origin and destination bold at the ends, a line
 * between them like the route card's timeline, hollow ink rings at the start and each connection, a
 * filled dot at the end: DFW ○──○──● LAX.
 *
 * Round 140 (John: "each leg is colored on the route line with a small label in between each leg", and
 * "Just color and seat availability. Let the user decide on the likelihood"): with `legs`, each leg's
 * stretch of line takes its seat color and its seat numbers ("40/2") sit small and centred above it in the
 * same color. The connecting airports moved under their dots so the numbers never run into them.
 * Drawn only; the row's own label says the route and seats for VoiceOver.
 */
export function MiniRoute({
  airports,
  legs,
  dimmed,
  stopFlags,
}: {
  airports: readonly string[];
  legs?: readonly MiniRouteLeg[];
  dimmed?: boolean;
  /**
   * One per connecting airport: a short word ("At risk", "Missed") shown in a small pill right on top of
   * that stop, above the seat numbers so they never collide (round 143, John: "Connection risk label
   * should sit on top of the connection station on the route line"). Null for a stop with nothing to say.
   */
  stopFlags?: readonly (string | null)[];
}) {
  const c = useColors();
  const ends = dimmed ? c.muted : c.text;
  const stops = airports.slice(1, -1);
  const first = airports[0];
  const last = airports[airports.length - 1];
  // Ink, not the accent: the mini route is read, not pressed (round 139).
  const ring = dimmed ? c.muted : c.text;
  const dot = (filled: boolean) => [styles.dot, { borderColor: ring, backgroundColor: filled ? ring : c.surface }];
  const n = Math.max(1, stops.length + 1);
  const segs = legs && legs.length === n ? legs : null;
  const pct = (i: number) => `${(i * 100) / n}%` as const;
  const stopFlagged = !!stopFlags?.some(Boolean);
  const legFlagged = !!segs?.some((l) => l.flag);
  const flagged = stopFlagged || legFlagged;
  const withFlights = !!segs?.some((l) => l.flight);
  // Short legs (2 or more stops on a small phone) drop the airline code beside a known airline's logo.
  const compact = n >= COMPACT_LEGS;
  // Flags get their own bands above the seat numbers: a flight's (delays) on top, a stop's (At risk)
  // nearest its dot, so a delay and the risk it causes never sit on each other.
  const legFlagTop = 0;
  const stopFlagTop = legFlagged ? FLAG_H : 0;
  // Everything in the track sits this far lower when there are flags above it.
  const top = (legFlagged ? FLAG_H : 0) + (stopFlagged ? FLAG_H : 0);
  const below = (y: number) => ({ top: top + y });
  return (
    <View
      style={[
        styles.row,
        segs && styles.rowLabeled,
        flagged && { paddingTop: 6 + top },
        withFlights && { paddingBottom: 6 + FLIGHT_H },
      ]}
      testID="mini-route"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {first}
      </Text>
      {/* Stops sit at even steps between the end dots (1 stop dead centre, 2 at thirds), each code
          centred under its own dot, whatever the codes' widths (round 122, John: the dot sat left). */}
      <View
        style={[
          styles.track,
          { minWidth: 40 + stops.length * STOP_W },
          {
            height: top + LABEL_H + DOT + LABEL_H + (withFlights ? FLIGHT_H : 0),
            marginTop: -(top + LABEL_H),
            marginBottom: -(LABEL_H + (withFlights ? FLIGHT_H : 0)),
          },
        ]}
        testID="mini-route-track">
        {segs ? null : <View style={[styles.line, below(LABEL_H + DOT / 2 - 1), { backgroundColor: c.line }]} />}
        {segs ? (
          <View style={styles.rail}>
            {segs.map((leg, i) => (
              <View
                key={`seg${i}`}
                style={[styles.seg, below(LABEL_H + DOT / 2 - 1.5), { left: pct(i), width: pct(1), backgroundColor: leg.color }]}
                testID="mini-route-seg"
              />
            ))}
            {segs.map((leg, i) =>
              // A canceled leg: an X dead centre on its red stretch (round 143, John: "Maybe an X indicator in
              // the middle with a red colored line?"). Drawn from two bars, on a small disc that hides the line.
              leg.canceled ? (
                <View
                  key={`x${i}`}
                  style={[styles.xSlot, below(LABEL_H + DOT / 2 - X_SIZE / 2), { left: pct(i + 0.5) }]}
                  testID="mini-route-canceled">
                  <View style={[styles.xDisc, { backgroundColor: c.surface, borderColor: leg.color }]}>
                    <View style={[styles.xBar, { backgroundColor: leg.color, transform: [{ rotate: '45deg' }] }]} />
                    <View style={[styles.xBar, { backgroundColor: leg.color, transform: [{ rotate: '-45deg' }] }]} />
                  </View>
                </View>
              ) : null,
            )}
            {segs.map((leg, i) => {
              if (!leg.flag) return null;
              // On a short leg the delay reads "+50m" so it stays inside its own stretch.
              const word = compact ? leg.flag.replace(/^Delayed /, '+').replace(/^Diverted.*/, 'Diverted') : leg.flag;
              return (
                <View
                  key={`lf${i}`}
                  style={[styles.flagSlot, styles.legFlagSlot, { top: legFlagTop, left: pct(i), width: pct(1) }]}
                  testID="mini-route-leg-flag">
                  <Text
                    style={[styles.flagText, { color: c.caution, backgroundColor: c.cautionBg }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.2}>
                    {word}
                  </Text>
                </View>
              );
            })}
            {segs.map((leg, i) => {
              // Each leg's flight under its own stretch, below the stop codes so the two never meet: the
              // airline's mark and the flight number, then the aircraft in small gray (round 145, John:
              // "fit the airline and aircraft underneath the route line ... aligned underneath").
              const f = leg.flight;
              if (!f) return null;
              const known = !!AIRLINE_MARKS[f.airline];
              const number = compact && known ? f.number : `${f.airline} ${f.number}`;
              return (
                <View
                  key={`fl${i}`}
                  style={[styles.flightSlot, below(LABEL_H + DOT + LABEL_H + 2), { left: pct(i), width: pct(1) }]}
                  testID="mini-route-flight">
                  <View style={styles.flightLine}>
                    {known ? <AirlineMark airline={f.airline} size={15} /> : null}
                    <Text
                      style={[styles.flightText, { color: ends }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      maxFontSizeMultiplier={1.15}
                      testID="mini-route-flight-number">
                      {number}
                    </Text>
                  </View>
                  {f.aircraft ? (
                    <Text
                      style={[styles.planeText, { color: c.muted }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      maxFontSizeMultiplier={1.15}
                      testID="mini-route-aircraft">
                      {f.aircraft}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {segs.map((leg, i) =>
              // A leg with nothing to say (canceled, no data) shows no label at all (round 142).
              !leg.label ? null : (
                <View
                  key={`lab${i}`}
                  style={[styles.legLabel, below(0), { left: pct(i), width: pct(1) }]}
                  testID="mini-route-leg-slot">
                  <Text
                    style={[styles.legText, { color: leg.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    maxFontSizeMultiplier={1.2}
                    testID="mini-route-leg-label">
                    {leg.label}
                  </Text>
                </View>
              ),
            )}
          </View>
        ) : null}
        <View style={[dot(false), styles.startDot, below(LABEL_H)]} />
        <View style={[dot(true), styles.endDot, below(LABEL_H)]} />
        <View style={styles.rail}>
          {stops.map((code, i) =>
            stopFlags?.[i] ? (
              <View
                key={`flag${code}${i}`}
                style={[styles.flagSlot, { top: stopFlagTop, left: `${((i + 1) * 100) / (stops.length + 1)}%` }]}
                testID="mini-route-stop-flag">
                <Text
                  style={[styles.flagText, { color: c.caution, backgroundColor: c.cautionBg }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}>
                  {stopFlags[i]}
                </Text>
              </View>
            ) : null,
          )}
          {stops.map((code, i) => (
            <View
              key={`${code}${i}`}
              style={[styles.stop, below(LABEL_H), { left: `${((i + 1) * 100) / (stops.length + 1)}%` }]}
              testID="mini-route-stop-slot">
              <View style={[dot(false), stopFlags?.[i] ? { borderColor: c.caution } : null]} />
              <Text
                style={[styles.stopCode, { color: c.muted }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                testID="mini-route-stop">
                {code}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {last}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  // With seat numbers above and codes below, the row keeps a little room each side so they don't crowd
  // the perforation or the flight chips.
  rowLabeled: { paddingVertical: 6 },
  code: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  // The track's labels sit above and its codes below the line, in room it pulls from outside its own box,
  // so the dots stay centred on the end codes.
  track: { flex: 1, height: LABEL_H + DOT + LABEL_H, marginTop: -LABEL_H, marginBottom: -LABEL_H },
  // The line runs from the start dot's centre to the end dot's centre.
  line: { position: 'absolute', left: DOT / 2, right: DOT / 2, height: 2, borderRadius: 1 },
  startDot: { position: 'absolute', left: 0 },
  endDot: { position: 'absolute', right: 0 },
  // Between the two end dots' centres; a stop's slot and each leg are placed by percent along it.
  rail: { position: 'absolute', left: DOT / 2, right: DOT / 2, top: 0, bottom: 0 },
  // One leg's stretch of line, a touch thicker than the plain line so its color reads.
  seg: { position: 'absolute', height: 3 },
  xSlot: { position: 'absolute', width: X_SIZE, height: X_SIZE, marginLeft: -X_SIZE / 2 },
  xDisc: {
    width: X_SIZE,
    height: X_SIZE,
    borderRadius: X_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xBar: { position: 'absolute', width: X_SIZE - 5, height: 1.5, borderRadius: 1 },
  // A connection's flag, centred over its stop, in the room above the seat numbers.
  flagSlot: { position: 'absolute', width: 80, marginLeft: -40, height: FLAG_H, alignItems: 'center' },
  // A flight's flag spans its own leg instead of centring on a point.
  legFlagSlot: { marginLeft: 0, paddingHorizontal: 2 },
  flagText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 6,
    borderRadius: 8.5,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  // A leg's seat numbers, centred over the middle of its stretch and never wider than it.
  legLabel: { position: 'absolute', height: LABEL_H, alignItems: 'center', paddingHorizontal: 4 },
  legText: { fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: LABEL_H },
  stop: { position: 'absolute', width: STOP_W, marginLeft: -STOP_W / 2, alignItems: 'center' },
  flightSlot: { position: 'absolute', height: FLIGHT_H - 2, alignItems: 'center', paddingHorizontal: 3 },
  flightLine: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  flightText: { flexShrink: 1, fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 18 },
  planeText: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 16, maxWidth: '100%' },
  stopCode: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: LABEL_H, letterSpacing: 0.3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
});
