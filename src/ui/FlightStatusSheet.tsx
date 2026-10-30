import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, localDate, type Flight } from '@/engine';
import { useFlightStatus, type FlightLookup, type UseFlightStatusOptions, type Movement } from '@/live';
import type { FlightStatusEntry } from '@/live/flightStatus';
import { answerText, answerTier, askNote, reportClosedNote, type AskState, type LoadAnswer, type ReportWindow } from '@/requests/requests';
import { shortDate } from '@/search/dates';
import { formatAge, forSpeech, TIER_WORD } from '@/search/format';
import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { ageText, delayText, movementTimes, placeText, sampleResponse, STATE_WORD } from './flightStatusText';
import { Icon } from './Icon';
import { useFocusOnMount } from './focusOnMount';
import { pressStyle } from './press';
import { ReportForm } from './ReportSheet';
import { STATE_TONE, TONE_BG, TONE_FG } from './statusTone';
import { SheetHeader } from './SheetHeader';
import { TIER_FG } from './tierColors';
import { useAnnounceLater } from './useAnnounceLater';

export interface FlightStatusSheetProps {
  /** The opened flight; null = closed (no request is made). */
  flight: Flight | null;
  /** Shown; defaults to having a flight. False while it slides away still showing its flight. */
  visible?: boolean;
  now: number;
  onClose: () => void;
  /** Test hook: fetcher / config / clock for the data hook. */
  liveOptions?: UseFlightStatusOptions;
  /**
   * The row's sample status (design round 4). When given, the sheet shows it,
   * labeled, and asks no server, so it always matches the row's tag.
   */
  sample?: FlightStatusEntry | null;
  /** Seats card (design round 32): report what the board shows, or ask someone at the airline. */
  load?: FlightLoadActions;
}

export interface FlightLoadActions {
  /** Report window: opens 7 days before departure, closes 2 hours after. */
  reportWindow: ReportWindow;
  askState: AskState;
  /** Your report on this flight this session. */
  yourReport: LoadAnswer | null;
  onAsk: () => void;
  onReport: (open: number, listed: number) => void;
}

export function lookupForFlight(f: Flight): FlightLookup {
  const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
  return { airline: f.airline, flightNumber: f.flightNumber, date: localDate(f.departUtc, tz), from: f.from, departUtc: f.departUtc };
}

/** Status for one opened flight: state, times with delay, gates and terminals, and how old it is. Text only. */
export function FlightStatusSheet({ flight, visible, now, onClose, liveOptions, sample, load }: FlightStatusSheetProps) {
  const c = useColors();
  // Report Load opens as a page inside this sheet (a second sheet on top can't open while one is up).
  const [reporting, setReporting] = useState(false);
  const announce = useAnnounceLater();
  // Back from the report page: VoiceOver lands on the Seats card again.
  const [backFromReport, setBackFromReport] = useState(false);
  const flightId = flight?.id;
  useEffect(() => {
    setReporting(false);
    setBackFromReport(false);
  }, [flightId]);
  const leaveReport = () => {
    setReporting(false);
    setBackFromReport(true);
  };
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
      <View
        key={label}
        accessible
        accessibilityLabel={forSpeech([`${label}, ${code}`, delay, movementTimes(m, tz), placeText(m)].filter(Boolean).join('. '))}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.top}>
          <Text style={[textStyles.number, { color: c.text }]}>{code}</Text>
          <Text style={[textStyles.small, { color: c.muted }]}>{label}</Text>
          {delay ? <Text style={[textStyles.bodyStrong, styles.trailing, { color: c.text }]}>{delay}</Text> : null}
        </View>
        {movementTimes(m, tz) ? <Text style={[textStyles.body, { color: c.text }]}>{movementTimes(m, tz)}</Text> : null}
        <Text style={[textStyles.body, { color: c.muted }]}>{placeText(m)}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible ?? flight !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        {reporting && load && flight ? (
          <ReportForm
            flight={flight}
            now={now}
            focusTitle
            onCancel={leaveReport}
            onSubmit={(open, listed) => {
              load.onReport(open, listed);
              leaveReport();
              announce(forSpeech(`Reported ${answerText({ open, listed, at: now })}`));
            }}
          />
        ) : (
          <>
            <SheetHeader title={title} subtitle={subtitle || undefined} action="Done" onAction={onClose} />
            <ScrollView contentContainerStyle={styles.body}>
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
                      <Icon name="xmark.circle" size={20} tintColor={c[TONE_FG[tone]]} fallback={null} />
                    ) : null}
                    <Text style={[textStyles.title, { color: tone ? c[TONE_FG[tone]] : c.text }]}>
                      {STATE_WORD[status.state]}
                    </Text>
                  </View>
                  {side('Departs', flight.from, status.departure)}
                  {side('Arrives', flight.to, status.arrival)}
                </>
              ) : null}
              {load && flight ? (
                <LoadCard load={load} now={now} focus={backFromReport} onReport={() => setReporting(true)} />
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
              {/* The source line names a real feed, so it shows only for live status (round 30: no sample labels). */}
              {isSample ? null : <Text style={[textStyles.small, { color: c.muted }]}>Data from AeroDataBox.</Text>}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/** Seats: your report if you made one, then Report Load and Ask for Load. */
function LoadCard({
  load,
  now,
  focus,
  onReport,
}: {
  load: FlightLoadActions;
  now: number;
  focus: boolean;
  onReport: () => void;
}) {
  const c = useColors();
  const { reportWindow, askState, yourReport, onAsk } = load;
  const headerRef = useFocusOnMount(focus);
  const canReport = reportWindow === 'open';
  const closed = reportClosedNote(reportWindow);
  const tier = yourReport ? answerTier(yourReport) : null;
  const asked = askState === 'asked';
  return (
    <View style={[styles.load, { backgroundColor: c.surface, borderColor: c.line }]} testID="load-card">
      <Text ref={headerRef} style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
        Seats
      </Text>
      {yourReport && tier ? (
        <Text
          style={[textStyles.body, { color: c.text }]}
          accessibilityLabel={forSpeech(`You reported ${answerText(yourReport)} · ${formatAge(yourReport.at, now)}`)}>
          {/* Amber means you; the tier word keeps its tier color. */}
          <Text style={{ color: c.youText }}>You reported </Text>
          <Text style={[textStyles.bodyStrong, { color: c[TIER_FG[tier]] }]}>{TIER_WORD[tier]}</Text>
          {` · ${yourReport.open} open · ${yourReport.listed} listed · ${formatAge(yourReport.at, now)}`}
        </Text>
      ) : null}
      {closed || !yourReport ? (
        <Text style={[textStyles.body, { color: c.muted }]}>
          {closed ?? 'Seen the board? Report the open seats and the standby list.'}
        </Text>
      ) : null}
      <Button label={yourReport ? 'Report Again' : 'Report Load'} onPress={onReport} disabled={!canReport} />
      <View style={[styles.loadRule, { backgroundColor: c.line }]} />
      <Text style={[textStyles.body, { color: c.muted }]}>{askNote(askState)}</Text>
      <Button
        label={asked ? 'Asked' : 'Ask for Load'}
        kind="secondary"
        icon={asked ? 'checkmark' : undefined}
        onPress={onAsk}
        disabled={askState !== 'ready'}
        // Asked is a confirmation, not an unavailable button: keep it full strength.
        style={asked ? styles.undimmed : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
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
  // Wraps at big text sizes; the delay stays right-aligned on whichever line it lands.
  top: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.group },
  trailing: { marginLeft: 'auto', flexShrink: 1 },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  load: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: spacing.group },
  loadRule: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  undimmed: { opacity: 1 },
});
