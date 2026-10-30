import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RouteImpact } from '@/live';
import { formatAge, forSpeech } from '@/search/format';
import { IMPACT_WORD } from '@/search/impactText';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { IMPACT_ICON } from './ImpactBadge';
import { SampleLabel } from './ResultsPanel';
import { SheetHeader } from './SheetHeader';

export interface ImpactSheetProps {
  visible: boolean;
  title: string;
  /** Route under the title, e.g. "DAL → PHX → LAX". */
  subtitle?: string | null;
  impact: RouteImpact | null;
  now: number;
  /** True while showing dev sample data (no live service yet). */
  sample: boolean;
  onClose: () => void;
}

/** Why a route has a delay/weather badge: each station, reasons, source and age. */
export function ImpactSheet({ visible, title, subtitle, impact, now, sample, onClose }: ImpactSheetProps) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title={title} subtitle={subtitle || undefined} action="Done" onAction={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          {sample ? (
            <View style={styles.sampleRow} accessible accessibilityLabel="Sample delays and weather. Live data is not connected yet.">
              <SampleLabel text="Sample delays" />
              <Text style={[textStyles.small, styles.sampleNote, { color: c.muted }]}>Live data isn’t connected yet.</Text>
            </View>
          ) : null}
          {impact?.stations.map((s) => {
            const likely = s.level === 'likelyDelays';
            const badge = s.level !== 'none';
            // One spoken line per station, in words (design round 26).
            const spoken = [
              `${s.code}, ${s.role === 'destination' ? 'destination' : 'connection'}, ${
                badge ? IMPACT_WORD[s.level as 'caution' | 'likelyDelays'].toLowerCase() : 'no disruption'
              }`,
              ...s.reasons.map((r) => `${r.text}, from ${r.source === 'FAA' ? 'FAA' : 'weather'}`),
              s.noForecast ? 'Weather forecast not available yet' : '',
              s.asOf ? `Updated ${forSpeech(formatAge(Date.parse(s.asOf), now))}${s.stale ? ', may be out of date' : ''}` : '',
            ]
              .filter(Boolean)
              .join('. ');
            return (
              <View
                key={`${s.role}-${s.code}`}
                accessible
                accessibilityLabel={spoken}
                style={[styles.station, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={styles.stationTop}>
                  <Text style={[textStyles.number, { color: c.text }]}>{s.code}</Text>
                  <Text style={[textStyles.small, { color: c.muted }]}>
                    {s.role === 'destination' ? 'Destination' : 'Connection'}
                  </Text>
                  {badge ? (
                    <View style={[styles.pill, styles.trailing, { backgroundColor: likely ? c.likelyDelaysBg : c.cautionBg }]}>
                      <Icon
                        name={IMPACT_ICON[s.level as 'caution' | 'likelyDelays']}
                        size={13}
                        tintColor={likely ? c.likelyDelays : c.caution}
                      />
                      <Text style={[textStyles.bodyStrong, { color: likely ? c.likelyDelays : c.caution }]}>
                        {IMPACT_WORD[s.level as 'caution' | 'likelyDelays']}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[textStyles.body, styles.trailing, { color: c.muted }]}>No disruption</Text>
                  )}
                </View>
                {s.reasons.map((r) => (
                  <Text key={`${r.source}-${r.text}`} style={[textStyles.body, { color: c.text }]}>
                    {r.text} <Text style={{ color: c.muted }}>· {r.source === 'FAA' ? 'FAA' : 'Weather'}</Text>
                  </Text>
                ))}
                {s.noForecast ? (
                  <Text style={[textStyles.small, { color: c.muted }]}>Weather forecast not available yet.</Text>
                ) : null}
                {s.asOf ? (
                  <Text style={[textStyles.small, { color: c.muted }]}>
                    Updated {formatAge(Date.parse(s.asOf), now)}
                    {s.stale ? ' · may be out of date' : ''}
                  </Text>
                ) : null}
              </View>
            );
          })}
          <Text style={[textStyles.small, { color: c.muted }]}>
            Sources: FAA airport status and aviationweather.gov forecasts. Checked at connection airports and your destination.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  sampleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, flexWrap: 'wrap' },
  sampleNote: { flexShrink: 1 },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  station: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: 4 },
  // Wraps at big text sizes; the badge stays right-aligned on whichever line it lands.
  stationTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  trailing: { marginLeft: 'auto', flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
});
