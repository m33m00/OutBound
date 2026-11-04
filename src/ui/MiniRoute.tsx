import { StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

/** Room above the line for each leg's seat numbers, and below it for a stop's code. */
const LABEL_H = 13;
const DOT = 8;
/** Each stop's slot, centred on its dot, wide enough for a three-letter code. */
const STOP_W = 36;

/** One leg of the line: the color it's drawn in and the seat numbers shown above it (round 140). */
export interface MiniRouteLeg {
  /** The line's color. */
  color: string;
  /** The numbers' color: the same hue, dark enough to read as small text. */
  text: string;
  label: string;
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
}: {
  airports: readonly string[];
  legs?: readonly MiniRouteLeg[];
  dimmed?: boolean;
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
  return (
    <View
      style={[styles.row, segs && styles.rowLabeled]}
      testID="mini-route"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {first}
      </Text>
      {/* Stops sit at even steps between the end dots (1 stop dead centre, 2 at thirds), each code
          centred under its own dot, whatever the codes' widths (round 122, John: the dot sat left). */}
      <View style={[styles.track, { minWidth: 40 + stops.length * STOP_W }]} testID="mini-route-track">
        {segs ? null : <View style={[styles.line, { backgroundColor: c.line }]} />}
        {segs ? (
          <View style={styles.rail}>
            {segs.map((leg, i) => (
              <View
                key={`seg${i}`}
                style={[styles.seg, { left: pct(i), width: pct(1), backgroundColor: leg.color }]}
                testID="mini-route-seg"
              />
            ))}
            {segs.map((leg, i) => (
              <View key={`lab${i}`} style={[styles.legLabel, { left: pct(i), width: pct(1) }]} testID="mini-route-leg-slot">
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
            ))}
          </View>
        ) : null}
        <View style={[dot(false), styles.startDot]} />
        <View style={[dot(true), styles.endDot]} />
        <View style={styles.rail}>
          {stops.map((code, i) => (
            <View
              key={`${code}${i}`}
              style={[styles.stop, { left: `${((i + 1) * 100) / (stops.length + 1)}%` }]}
              testID="mini-route-stop-slot">
              <View style={dot(false)} />
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
  line: { position: 'absolute', left: DOT / 2, right: DOT / 2, top: LABEL_H + DOT / 2 - 1, height: 2, borderRadius: 1 },
  startDot: { position: 'absolute', left: 0, top: LABEL_H },
  endDot: { position: 'absolute', right: 0, top: LABEL_H },
  // Between the two end dots' centres; a stop's slot and each leg are placed by percent along it.
  rail: { position: 'absolute', left: DOT / 2, right: DOT / 2, top: 0, bottom: 0 },
  // One leg's stretch of line, a touch thicker than the plain line so its color reads.
  seg: { position: 'absolute', top: LABEL_H + DOT / 2 - 1.5, height: 3 },
  // A leg's seat numbers, centred over the middle of its stretch and never wider than it.
  legLabel: { position: 'absolute', top: 0, height: LABEL_H, alignItems: 'center', paddingHorizontal: DOT },
  legText: { fontFamily: fonts.monoMedium, fontSize: 11, lineHeight: LABEL_H },
  stop: { position: 'absolute', top: LABEL_H, width: STOP_W, marginLeft: -STOP_W / 2, alignItems: 'center' },
  stopCode: { fontFamily: fonts.monoMedium, fontSize: 10, lineHeight: LABEL_H, letterSpacing: 0.3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
});
