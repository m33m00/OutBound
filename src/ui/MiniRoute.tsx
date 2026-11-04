import { StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

/** Room above the line for a stop's code. */
const LABEL_H = 13;
const DOT = 8;
/** Each stop's slot, centred on its dot, wide enough for a three-letter code. */
const STOP_W = 36;

/**
 * A market at a glance on a result card (round 119, John picked the mini route line on
 * 2026-11-03; Clean styling since round 120): the origin and destination bold at the ends, a soft
 * line between them like the route card's timeline, hollow ink rings at the start and each
 * connection, a filled dot at the end, and each connecting airport small above its own ring:
 * DFW ○──○──● LAX. Drawn only; the row's own label says the route for VoiceOver.
 */
export function MiniRoute({ airports, dimmed }: { airports: readonly string[]; dimmed?: boolean }) {
  const c = useColors();
  const ends = dimmed ? c.muted : c.text;
  const stops = airports.slice(1, -1);
  const first = airports[0];
  const last = airports[airports.length - 1];
  // Ink, not the accent: the mini route is read, not pressed (round 139).
  const ring = dimmed ? c.muted : c.text;
  const dot = (filled: boolean) => [styles.dot, { borderColor: ring, backgroundColor: filled ? ring : c.surface }];
  return (
    <View style={styles.row} testID="mini-route" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {first}
      </Text>
      {/* Stops sit at even steps between the end dots (1 stop dead centre, 2 at thirds), each code
          centred over its own dot, whatever the codes' widths (round 122, John: the dot sat left). */}
      <View style={[styles.track, { minWidth: 40 + stops.length * STOP_W }]} testID="mini-route-track">
        <View style={[styles.line, { backgroundColor: c.line }]} />
        <View style={[dot(false), styles.startDot]} />
        <View style={[dot(true), styles.endDot]} />
        <View style={styles.rail}>
          {stops.map((code, i) => (
            <View
              key={`${code}${i}`}
              style={[styles.stop, { left: `${((i + 1) * 100) / (stops.length + 1)}%` }]}
              testID="mini-route-stop-slot">
              <Text
                style={[styles.stopCode, { color: c.muted }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                testID="mini-route-stop">
                {code}
              </Text>
              <View style={dot(false)} />
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
  code: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
  // The stop codes sit above the line in room the track pulls up from above the row, so the dots
  // stay centred on the end codes and the row is no taller than the codes.
  track: { flex: 1, height: LABEL_H + DOT, marginTop: -LABEL_H },
  // The line runs from the start dot's centre to the end dot's centre.
  line: { position: 'absolute', left: DOT / 2, right: DOT / 2, top: LABEL_H + DOT / 2 - 1, height: 2, borderRadius: 1 },
  startDot: { position: 'absolute', left: 0, top: LABEL_H },
  endDot: { position: 'absolute', right: 0, top: LABEL_H },
  // Between the two end dots' centres; a stop's slot is placed by percent along it.
  rail: { position: 'absolute', left: DOT / 2, right: DOT / 2, top: 0, bottom: 0 },
  stop: { position: 'absolute', top: 0, width: STOP_W, marginLeft: -STOP_W / 2, alignItems: 'center' },
  stopCode: { fontFamily: fonts.monoMedium, fontSize: 10, lineHeight: LABEL_H, letterSpacing: 0.3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
});
