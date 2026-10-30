import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, localDate, type Flight } from '@/engine';
import { useFlightStatus, type FlightLookup, type UseFlightStatusOptions, type Movement } from '@/live';
import type { FlightStatusEntry } from '@/live/flightStatus';
import { shortDate } from '@/search/dates';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { ageText, delayText, movementTimes, placeText, sampleResponse, STATE_WORD } from './flightStatusText';
import { pressStyle } from './press';
import { SampleLabel } from './ResultsPanel';
import { STATE_TONE, TONE_BG, TONE_FG } from './statusTone';

export interface FlightStatusSheetProps {
  /** The opened flight; null = closed (no request is made). */
  flight: Flight | null;
  now: number;
  onClose: () => void;
  /** Test hook: fetcher / config / clock for the data hook. */
  liveOptions?: UseFlightStatusOptions;
  /**
   * The row's sample status (design round 4). When given, the sheet shows it,
   * labeled, and asks no server, so it always matches the row's tag.
   */
  sample?: FlightStatusEntry | null;
}

export function lookupForFlight(f: Flight): FlightLookup {
  const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
  return { airline: f.airline, flightNumber: f.flightNumber, date: localDate(f.departUtc, tz), from: f.from, departUtc: f.departUtc };
}

/** Status for one opened flight: state, times with delay, gates and terminals, and how old it is. Text only. */
export function FlightStatusSheet({ flight, now, onClose, liveOptions, sample }: FlightStatusSheetProps) {
  const c = useColors();
  const lookup = flight ? lookupForFlight(flight) : null;
  const isSample = !!(flight && sample);
  const live = useFlightStatus(isSample ? null : lookup, liveOptions);
  const { loading, error, refresh } = isSample ? { loading: false, error: null, refresh: live.refresh } : live;
  const response = isSample && flight && sample && lookup ? sampleResponse(sample, flight, lookup.date) : live.response;
  const status = response?.status ?? null;
  const title = flight ? `${flight.airline} ${flight.flightNumber}` : 'Flight status';
  const subtitle = flight && lookup ? `${flight.from} → ${flight.to} · ${shortDate(lookup.date)}` : null;
  const tone = status ? STATE_TONE[status.state] : null;

  const side = (label: string, code: string, m: Movement) => {
    const tz = AIRPORTS[code]?.tz ?? 'UTC';
    const delayWord = delayText(m.delayMin);
    // The title already says "On time" for a scheduled flight; don't repeat it on each card.
    const delay = delayWord === 'On time' && status?.state === 'scheduled' ? null : delayWord;
    return (
      <View key={label} accessible style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.top}>
          <Text style={[textStyles.number, { color: c.text }]}>{code}</Text>
          <Text style={[textStyles.small, { color: c.muted }]}>{label}</Text>
          <View style={styles.spacer} />
          {delay ? <Text style={[textStyles.bodyStrong, { color: c.text }]}>{delay}</Text> : null}
        </View>
        {movementTimes(m, tz) ? <Text style={[textStyles.body, { color: c.text }]}>{movementTimes(m, tz)}</Text> : null}
        <Text style={[textStyles.body, { color: c.muted }]}>{placeText(m)}</Text>
      </View>
    );
  };

  return (
    <Modal visible={flight !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.title}>
            <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={[textStyles.bodyStrong, { color: c.muted }]}>{subtitle}</Text> : null}
          </View>
          <Button label="Done" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {isSample ? (
            <View style={styles.sampleRow}>
              <SampleLabel text="Sample status" />
            </View>
          ) : null}
          {error === 'not_configured' ? (
            <Text style={[textStyles.body, { color: c.muted }]}>Flight status is not connected yet.</Text>
          ) : null}
          {error === 'fetch_failed' && !response ? (
            <Text style={[textStyles.body, { color: c.text }]}>Couldn’t get flight status. Try again in a moment.</Text>
          ) : null}
          {loading && !response ? <ActivityIndicator accessibilityLabel="Loading flight status" /> : null}
          {response && !status ? (
            <Text style={[textStyles.body, { color: c.text }]}>
              {response.state === 'unavailable'
                ? "Couldn’t get flight status. Try again in a moment."
                : "The airline data source doesn’t list this flight yet."}
            </Text>
          ) : null}
          {status && flight ? (
            <>
              {/* Same colors as the row tags (Q-050); the word carries the state. */}
              <View
                accessible
                accessibilityLabel={`Status: ${STATE_WORD[status.state]}`}
                style={[
                  styles.state,
                  {
                    backgroundColor: tone ? c[TONE_BG[tone]] : c.surface2,
                    // Gray tones get an edge, like the row tag, so the pill shows on the page.
                    borderColor: !tone || tone === 'gone' ? c.line2 : c[TONE_BG[tone]],
                  },
                ]}>
                {tone === 'canceled' ? (
                  <SymbolView name="xmark.circle" size={20} tintColor={c[TONE_FG[tone]]} fallback={null} />
                ) : null}
                <Text style={[textStyles.title, { color: tone ? c[TONE_FG[tone]] : c.text }]}>
                  {STATE_WORD[status.state]}
                </Text>
              </View>
              {side('Departs', flight.from, status.departure)}
              {side('Arrives', flight.to, status.arrival)}
            </>
          ) : null}
          {response ? <Text style={[textStyles.small, { color: c.muted }]}>{ageText(response, now)}</Text> : null}
          {error === 'fetch_failed' && response ? (
            <Text style={[textStyles.small, { color: c.muted }]}>Couldn’t refresh just now; showing the last status.</Text>
          ) : null}
          {error !== 'not_configured' && !isSample ? (
            <Pressable
              onPress={() => refresh()}
              accessibilityRole="button"
              accessibilityLabel="Refresh flight status"
              style={pressStyle(styles.refresh, 'link')}>
              <Text style={[textStyles.bodyStrong, { color: c.accent }]}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
            </Pressable>
          ) : null}
          <Text style={[textStyles.small, { color: c.muted }]}>
            {isSample
              ? 'Times are local to each airport.'
              : 'Times are local to each airport. Refresh works about every 2 minutes.'}
          </Text>
          <Text style={[textStyles.small, { color: c.muted }]}>
            {isSample
              ? 'This is sample status for trying the app. Real status shows once flight data is connected.'
              : 'Data from AeroDataBox.'}
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
  title: { flex: 1, gap: 2 },
  sampleRow: { flexDirection: 'row' },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.group,
    paddingHorizontal: spacing.rowX,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  spacer: { flex: 1 },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
