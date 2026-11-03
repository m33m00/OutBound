import { StyleSheet, Text, View } from 'react-native';

import { fonts, useColors } from '@/theme';

/** Room above the line for a stop's code. */
const LABEL_H = 13;
const DOT = 7;

/**
 * A market at a glance on a result card (round 119, John picked the mini route line on
 * 2026-11-03): the origin and destination big at the ends in the board face, a line between them,
 * and each connecting airport small above its own dot: DFW ●──●──● LAX. Drawn only; the row's own
 * label says the route for VoiceOver.
 */
export function MiniRoute({ airports, dimmed }: { airports: readonly string[]; dimmed?: boolean }) {
  const c = useColors();
  const ends = dimmed ? c.muted : c.text;
  const stops = airports.slice(1, -1);
  const first = airports[0];
  const last = airports[airports.length - 1];
  const dot = (hollow: boolean) => [
    styles.dot,
    { borderColor: hollow ? c.muted : ends, backgroundColor: hollow ? c.surface : ends },
  ];
  return (
    <View style={styles.row} testID="mini-route" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {first}
      </Text>
      <View style={styles.track}>
        <View style={dot(false)} />
        {stops.map((code) => (
          <View key={code} style={styles.stopWrap}>
            <View style={[styles.line, { backgroundColor: c.line2 }]} />
            <View style={styles.stop}>
              <Text
                style={[styles.stopCode, { color: c.muted }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                testID="mini-route-stop">
                {code}
              </Text>
              <View style={dot(true)} />
            </View>
          </View>
        ))}
        <View style={[styles.line, { backgroundColor: c.line2 }]} />
        <View style={dot(false)} />
      </View>
      <Text style={[styles.code, { color: ends }]} maxFontSizeMultiplier={1.3}>
        {last}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  code: { fontFamily: fonts.board, fontSize: 22, lineHeight: 24, letterSpacing: 0.6 },
  // The stop codes sit above the line, so the line drops by half their height to stay centred on the ends.
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 40, paddingTop: LABEL_H },
  stopWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: 2, borderRadius: 1, minWidth: 8 },
  stop: { alignItems: 'center', marginTop: -LABEL_H },
  stopCode: { fontFamily: fonts.monoMedium, fontSize: 10, lineHeight: LABEL_H, letterSpacing: 0.3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5 },
});
