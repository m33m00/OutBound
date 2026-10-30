import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RouteImpact } from '@/live';
import { formatAge, forSpeech } from '@/search/format';
import { IMPACT_WORD } from '@/search/impactText';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { IMPACT_ICON } from './ImpactBadge';
import { SheetHeader } from './SheetHeader';

export interface ImpactSheetProps {
  visible: boolean;
  title: string;
  /** Route under the title, e.g. "DAL → PHX → LAX". */
  subtitle?: string | null;
  impact: RouteImpact | null;
  now: number;
  onClose: () => void;
}

/** Why a route has a delay/weather badge: each station, reasons, source and age. */
export function ImpactSheet({ visible, title, subtitle, impact, now, onClose }: ImpactSheetProps) {
  const c = useColors();
  const sorted = [...(impact?.stations ?? [])].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title={title} subtitle={subtitle || undefined} action="Done" onAction={onClose} />
        <ScrollView contentContainerStyle={styles.body}>
          {!impact?.stations.length ? (
            <Text style={[textStyles.body, { color: c.text }]}>No delay or weather data for this route yet.</Text>
          ) : null}
          {/* Worst first, so the airport to worry about is on top; route order otherwise. */}
          {sorted.length > 1 && sorted.some((s, i) => s !== impact?.stations[i]) ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>Worst first</Text>
          ) : null}
          {sorted.map((s) => {
            const likely = s.level === 'likelyDelays';
            const badge = s.level !== 'none';
            // No badge only says what was checked. With no forecast (Q-028) only FAA can have been checked.
            const clearWord = s.noForecast
              ? s.asOf
                ? 'No FAA delays'
                : 'No weather forecast'
              : s.asOf
                ? 'No known disruption'
                : 'No data yet';
            // The forecast line under the badge, unless the trailing word already says it.
            const forecastLine = s.noForecast && (badge || s.asOf);
            // One spoken line per station, in words (design round 26).
            const spoken = [
              `${s.code}, ${s.role === 'destination' ? 'destination' : 'connection'}, ${
                badge ? IMPACT_WORD[s.level as 'caution' | 'likelyDelays'].toLowerCase() : clearWord.toLowerCase()
              }`,
              ...s.reasons.map((r) => `${r.text}, from ${r.source === 'FAA' ? 'FAA' : 'weather'}`),
              forecastLine ? 'No weather forecast for this airport' : '',
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
                  <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
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
                    <Text style={[textStyles.body, styles.trailing, { color: c.muted }]}>{clearWord}</Text>
                  )}
                </View>
                {s.reasons.map((r) => (
                  <Text key={`${r.source}-${r.text}`} style={[textStyles.body, { color: c.text }]}>
                    {r.text} <Text style={{ color: c.muted }}>· {r.source === 'FAA' ? 'FAA' : 'Weather'}</Text>
                  </Text>
                ))}
                {forecastLine ? (
                  <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>No weather forecast for this airport.</Text>
                ) : null}
                {s.asOf ? (
                  <View style={styles.ageLine}>
                    {s.stale ? (
                      <View style={styles.ageIcon}>
                        <Icon name="clock" size={13} tintColor={c.text} fallback={null} />
                      </View>
                    ) : null}
                    <Text style={[s.stale ? textStyles.bodyStrong : textStyles.small, styles.ageText, { color: s.stale ? c.text : c.muted }]}>
                      Updated {formatAge(Date.parse(s.asOf), now)}
                      {s.stale ? ' · may be out of date' : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
          {impact?.stations.length ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
              Sources: FAA airport status and aviationweather.gov forecasts. Checked at connection airports and your destination.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const LEVEL_ORDER = { likelyDelays: 0, caution: 1, none: 2 } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  station: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: 4 },
  // Wraps at big text sizes; the badge stays right-aligned on whichever line it lands.
  stationTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  trailing: { marginLeft: 'auto', flexShrink: 1 },
  ageLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  ageIcon: { marginTop: 3 },
  ageText: { flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
});
