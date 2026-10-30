import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, localDate, type Flight } from '@/engine';
import { useFlightStatus, type FlightLookup, type UseFlightStatusOptions, type Movement } from '@/live';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { ageText, delayText, movementTimes, placeText, STATE_WORD } from './flightStatusText';
import { pressStyle } from './press';

export interface FlightStatusSheetProps {
  /** The opened flight; null = closed (no request is made). */
  flight: Flight | null;
  now: number;
  onClose: () => void;
  /** Test hook: fetcher / config / clock for the data hook. */
  liveOptions?: UseFlightStatusOptions;
}

export function lookupForFlight(f: Flight): FlightLookup {
  const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
  return { airline: f.airline, flightNumber: f.flightNumber, date: localDate(f.departUtc, tz), from: f.from, departUtc: f.departUtc };
}

/** Status for one opened flight: state, times with delay, gates and terminals, and how old it is. Text only. */
export function FlightStatusSheet({ flight, now, onClose, liveOptions }: FlightStatusSheetProps) {
  const c = useColors();
  const { response, loading, error, refresh } = useFlightStatus(flight ? lookupForFlight(flight) : null, liveOptions);
  const status = response?.status ?? null;
  const title = flight ? `${flight.airline} ${flight.flightNumber} · ${flight.from} → ${flight.to}` : 'Flight status';

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
          <Text style={[textStyles.title, styles.title, { color: c.text }]} accessibilityRole="header">
            {title}
          </Text>
          <Button label="Done" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {error === 'not_configured' ? (
            <Text style={[textStyles.body, { color: c.muted }]}>Flight status is not connected yet.</Text>
          ) : null}
          {error === 'fetch_failed' && !response ? (
            <Text style={[textStyles.body, { color: c.text }]}>Couldn't get flight status. Try again in a moment.</Text>
          ) : null}
          {loading && !response ? <ActivityIndicator accessibilityLabel="Loading flight status" /> : null}
          {response && !status ? (
            <Text style={[textStyles.body, { color: c.text }]}>
              {response.state === 'unavailable'
                ? "Couldn't get flight status. Try again in a moment."
                : "The airline data source doesn't list this flight yet."}
            </Text>
          ) : null}
          {status && flight ? (
            <>
              <Text style={[textStyles.title, { color: c.text }]} accessibilityLabel={`Status: ${STATE_WORD[status.state]}`}>
                {STATE_WORD[status.state]}
              </Text>
              {side('Departs', flight.from, status.departure)}
              {side('Arrives', flight.to, status.arrival)}
            </>
          ) : null}
          {response ? <Text style={[textStyles.small, { color: c.muted }]}>{ageText(response, now)}</Text> : null}
          {error === 'fetch_failed' && response ? (
            <Text style={[textStyles.small, { color: c.muted }]}>Couldn't refresh just now; showing the last status.</Text>
          ) : null}
          {error !== 'not_configured' ? (
            <Pressable
              onPress={() => refresh()}
              accessibilityRole="button"
              accessibilityLabel="Refresh flight status"
              style={pressStyle(styles.refresh, 'link')}>
              <Text style={[textStyles.bodyStrong, { color: c.accent }]}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
            </Pressable>
          ) : null}
          <Text style={[textStyles.small, { color: c.muted }]}>
            Times are local to each airport. Refresh works about every 2 minutes.
          </Text>
          <Text style={[textStyles.small, { color: c.muted }]}>Data from AeroDataBox.</Text>
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
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  spacer: { flex: 1 },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
