import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';

export type PreviewPhase = 'idle' | 'playing' | 'done' | 'cancelled' | 'reduceMotion';

export interface PreviewControlProps {
  phase: PreviewPhase;
  /** Simulated time during playback (epoch ms), shown in the phone's time zone. */
  simUtc: number | null;
  progress: number;
  onPlay: () => void;
  onStop: () => void;
}

// Time with its zone ("9:40 PM EDT") so it's never ambiguous when you're traveling.
const zoned = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

/**
 * Flight preview control (item 11; button only). The preview is a simulation
 * of scheduled times, never a live aircraft position, so it's always labeled.
 */
export function PreviewControl({ phase, simUtc, progress, onPlay, onStop }: PreviewControlProps) {
  const c = useColors();
  if (phase === 'playing') {
    const time = simUtc != null ? ` · ${zoned.format(new Date(simUtc))}` : '';
    return (
      <View style={[styles.hud, { backgroundColor: c.surface2 }]}>
        <SymbolView name="airplane" size={14} tintColor={c.accent} />
        {/* No live region: the label changes several times a second. */}
        <View style={styles.hudText} accessible accessibilityLabel={`Flight preview${time}, ${Math.round(progress * 100)} percent`}>
          <Text style={[textStyles.bodyStrong, { color: c.text }]}>Preview{time}</Text>
          <View style={[styles.track, { backgroundColor: c.line2 }]}>
            <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
        <Button label="Stop" kind="secondary" onPress={onStop} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Button
        label={phase === 'done' ? 'Replay Preview' : 'Preview Flight'}
        kind="secondary"
        onPress={onPlay}
        accessibilityLabel="Preview this flight on the globe"
      />
      {phase === 'reduceMotion' ? (
        <Text style={[textStyles.small, styles.note, { color: c.muted }]}>Preview is off because Reduce Motion is on.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, flexWrap: 'wrap' },
  note: { flexShrink: 1 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    padding: spacing.group,
    borderRadius: radius.md,
  },
  hudText: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
});
