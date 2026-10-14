import { SymbolView } from 'expo-symbols';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RouteImpact } from '@/live';
import { formatAge } from '@/search/format';
import { IMPACT_WORD } from '@/search/impactText';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { IMPACT_ICON } from './ImpactBadge';

export interface ImpactSheetProps {
  visible: boolean;
  title: string;
  impact: RouteImpact | null;
  now: number;
  /** True while showing dev sample data (no live service yet). */
  sample: boolean;
  onClose: () => void;
}

/** Why a route has a delay/weather badge: each station, reasons, source and age. */
export function ImpactSheet({ visible, title, impact, now, sample, onClose }: ImpactSheetProps) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[textStyles.title, styles.title, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Button label="Done" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {sample ? (
            <Text style={[textStyles.small, { color: c.muted }]}>Sample delays and weather (live data not connected yet).</Text>
          ) : null}
          {impact?.stations.map((s) => {
            const likely = s.level === 'likelyDelays';
            const badge = s.level !== 'none';
            return (
              <View
                key={`${s.role}-${s.code}`}
                accessible
                style={[styles.station, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={styles.stationTop}>
                  <Text style={[textStyles.number, { color: c.text }]}>{s.code}</Text>
                  <Text style={[textStyles.small, { color: c.muted }]}>
                    {s.role === 'destination' ? 'Destination' : 'Connection'}
                  </Text>
                  <View style={styles.spacer} />
                  {badge ? (
                    <View style={[styles.pill, { backgroundColor: likely ? c.likelyDelaysBg : c.cautionBg }]}>
                      <SymbolView
                        name={IMPACT_ICON[s.level as 'caution' | 'likelyDelays']}
                        size={13}
                        tintColor={likely ? c.likelyDelays : c.caution}
                      />
                      <Text style={[textStyles.bodyStrong, { color: likely ? c.likelyDelays : c.caution }]}>
                        {IMPACT_WORD[s.level as 'caution' | 'likelyDelays']}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[textStyles.body, { color: c.muted }]}>No disruption</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.section,
    gap: spacing.group,
  },
  title: { flex: 1 },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  station: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: 4 },
  stationTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  spacer: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
});
