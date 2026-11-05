import { StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

import { FlightPeek, PEEK_LOGO } from './FlightPeek';
import { Icon } from './Icon';

/** Room above the line for each leg's seat numbers, and below it for a stop's code. */
const LABEL_H = 16;
const DOT = 8;
/** Each stop's slot, centred on its dot, wide enough for a three-letter code. */
const STOP_W = 40;
/** Room above the seat numbers for a connection's flag ("At risk"), only when a route has one. */
const FLAG_H = 21;
/** Room over the seat numbers for the tiny seat and person icons (round 147). */
const ICON_H = 12;
const ICON = 11;
/** The icon over each kind of seat count: open seats and people listed (round 147, John). */
export const COUNT_ICON = { seats: 'carseat.right.fill', listed: 'person.fill' } as const;
/** The X on a canceled leg. */
const X_SIZE = 12;
/** Room under the stop codes for each leg's airline logo (round 156: logo only, the number and aircraft
 * open from it). */
const FLIGHT_H = PEEK_LOGO + 6;
/** With this many legs or more, a diversion pill says just "Diverted" to fit its short stretch. */
const COMPACT_LEGS = 3;

/** One leg of the line: the color it's drawn in and the seat numbers shown above it (round 140). */
export interface MiniRouteLeg {
  /** The line's color. */
  color: string;
  /** The numbers' color: the same hue, dark enough to read as small text. */
  text: string;
  label: string;
  /**
   * The label's numbers, each with a tiny icon over it: a seat over the open seats, a person over the people
   * listed (round 147, John: "can you put like a tiny icon above each number ... a little person, and then
   * the other one being like a seat?"). Drawn in place of `label` when given.
   */
  counts?: readonly { kind: keyof typeof COUNT_ICON; value: string }[];
  /** Canceled: drawn red with an X in the middle (round 143, John). */
  canceled?: boolean;
  /**
   * A live word for this flight ("50m late"), in a pill centred on its own stretch of line, under its airline
   * logo (rounds 146, 148, 157, John: "Can the logos sit on top of the delayed pill and delay pill sits
   * underneath the logo?").
   */
  flag?: string | null;
  /**
   * The leg's flight: its airline's logo under its stretch of line, which opens the number and aircraft
   * (rounds 145, 156, John).
   */
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
  // Room above the line for count icons, and for a canceled leg's pill (round 151).
  const withIcons = !!segs?.some((l) => (l.label && l.counts?.length) || l.canceled);
  // Short legs (2 or more stops on a small phone) shorten a diversion's pill.
  const compact = n >= COMPACT_LEGS;
  // A stop's flag (At risk) sits above the line over its stop. A flight's flag (a delay) sits under the
  // line: the stop codes, then the airline logo, then the delay under the logo (round 157, John: "Can the
  // logos sit on top of the delayed pill and delay pill sits underneath the logo?").
  const stopFlagTop = 0;
  // Everything in the track sits this far lower when there are flags or count icons above it.
  const top = (stopFlagged ? FLAG_H : 0) + (withIcons ? ICON_H : 0);
  const below = (y: number) => ({ top: top + y });
  // Each leg's logo sits just under the line, level with the stop codes beside it (round 158, John: "Can the
  // airline logo be scooted up closer to the route line"); a logo centred on its leg clears the codes centred
  // on the dots, even on a 2-stop ticket. A delay pill goes under the logo.
  const flightY = LABEL_H + DOT + 3;
  const legFlagY = withFlights ? flightY + FLIGHT_H - 4 : LABEL_H + DOT + LABEL_H + 2;
  const base = LABEL_H + DOT + LABEL_H;
  const tail = Math.max(0, (withFlights ? flightY + FLIGHT_H : 0) - base, legFlagged ? legFlagY + FLAG_H - base : 0);
  return (
    <View
      style={[styles.row, segs && styles.rowLabeled, top > 0 && { paddingTop: 6 + top }, tail > 0 && { paddingBottom: 6 + tail }]}
      testID="mini-route"
      // Drawn only for VoiceOver: the card's own label says the route, flights and seats.
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
            height: top + LABEL_H + DOT + LABEL_H + tail,
            marginTop: -(top + LABEL_H),
            marginBottom: -(LABEL_H + tail),
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
            {segs.map((leg, i) =>
              // A small red pill over the X says what it means (round 151, John: "some people may not
              // understand what the small red X means").
              leg.canceled ? (
                <View
                  key={`cx${i}`}
                  style={[styles.countsSlot, below(-ICON_H), { left: pct(i), width: pct(1) }]}
                  testID="mini-route-canceled-pill">
                  <Text
                    style={[styles.flagText, styles.canceledPill, { color: c.canceledFg, backgroundColor: c.canceledBg }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.2}>
                    Canceled
                  </Text>
                </View>
              ) : null,
            )}
            {segs.map((leg, i) => {
              if (!leg.flag) return null;
              // On a short leg the delay reads "+50m" so it stays inside its own stretch.
              const word = compact ? leg.flag.replace(/^Diverted.*/, 'Diverted') : leg.flag;
              return (
                <View
                  key={`lf${i}`}
                  style={[styles.flagSlot, styles.legFlagSlot, below(legFlagY), { left: pct(i), width: pct(1) }]}
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
              // Each leg's airline logo under its own stretch, below the stop codes so the two never meet. Only
              // the logo: a tap or hold opens the flight number and aircraft (round 156, John).
              const f = leg.flight;
              if (!f) return null;
              return (
                <View
                  key={`fl${i}`}
                  pointerEvents="box-none"
                  style={[styles.flightSlot, below(flightY), { left: pct(i), width: pct(1) }]}
                  testID="mini-route-flight">
                  <FlightPeek airline={f.airline} number={f.number} aircraft={f.aircraft} />
                </View>
              );
            })}
            {segs.map((leg, i) =>
              // A leg with nothing to say (canceled, no data) shows no label at all (round 142).
              !leg.label ? null : leg.counts?.length ? (
                <View
                  key={`lab${i}`}
                  style={[styles.countsSlot, below(-ICON_H), { left: pct(i), width: pct(1) }]}
                  testID="mini-route-leg-slot">
                  {leg.counts.map((k, j) => (
                    <View key={k.kind} style={styles.countRow}>
                      {j > 0 ? (
                        <Text style={[styles.legText, { color: leg.text }]} maxFontSizeMultiplier={1.2}>
                          /
                        </Text>
                      ) : null}
                      <View style={styles.count} testID={`mini-route-count-${k.kind}`}>
                        <Icon name={COUNT_ICON[k.kind]} size={ICON} tintColor={leg.text} fallback={null} />
                        <Text
                          style={[styles.legText, { color: leg.text }]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.2}
                          testID="mini-route-count-value">
                          {k.value}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
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
  // Clear of the X's disc just under it.
  canceledPill: { marginBottom: 3 },
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
  // Numbers with an icon over each, the slash on the numbers' baseline.
  countsSlot: {
    position: 'absolute',
    height: ICON_H + LABEL_H,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  countRow: { flexDirection: 'row', alignItems: 'flex-end' },
  count: { alignItems: 'center', height: ICON_H + LABEL_H, justifyContent: 'flex-end', gap: 1 },
  stop: { position: 'absolute', width: STOP_W, marginLeft: -STOP_W / 2, alignItems: 'center' },
  flightSlot: { position: 'absolute', height: FLIGHT_H - 2, alignItems: 'center', paddingHorizontal: 3 },
  stopCode: { fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: LABEL_H, letterSpacing: 0.3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
});
