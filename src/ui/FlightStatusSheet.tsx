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
import { ageText, delayText, movementLead, movementSpoken, placeText, sampleResponse, STATE_WORD } from './flightStatusText';
import { Icon } from './Icon';
import { useFocusOnMount } from './focusOnMount';
import { LogFlightLink } from './LogFlightLink';
import { pressStyle } from './press';
import { ReportForm } from './ReportSheet';
import { STATE_TONE, TONE_BG, TONE_FG } from './statusTone';
import { SheetHeader, TITLE_MAX_SCALE } from './SheetHeader';
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
  /** The answer to your ask, once someone has given one. */
  askAnswer?: LoadAnswer | null;
  /** Take back a waiting ask (round 34). */
  onCancelAsk?: () => void;
  /** Opened from My Trips: a waiting ask says so instead of pointing at My Trips. */
  fromTrips?: boolean;
}

export function lookupForFlight(f: Flight): FlightLookup {
  const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
  return { airline: f.airline, flightNumber: f.flightNumber, date: localDate(f.departUtc, tz), from: f.from, departUtc: f.departUtc };
}

const FETCH_FAILED_TEXT = 'Couldn’t get flight status. Try again in a moment.';

/** Status for one opened flight: state, times with delay, gates and terminals, and how old it is. Text only. */
export function FlightStatusSheet({ flight, visible, now, onClose, liveOptions, sample, load }: FlightStatusSheetProps) {
  const c = useColors();
  // Report Load opens as a page inside this sheet (a second sheet on top can't open while one is up).
  const [reporting, setReporting] = useState(false);
  const announce = useAnnounceLater();
  // Back from the report page: VoiceOver lands on the Seats card again.
  const [backFromReport, setBackFromReport] = useState(false);
  // Shown after a refresh tap inside the 2-minute wait.
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const flightId = flight?.id;
  useEffect(() => {
    setReporting(false);
    setBackFromReport(false);
    setRefreshNote(null);
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
  // A new fetch or a new answer replaces the "can't refresh yet" note.
  useEffect(() => {
    if (loading) setRefreshNote(null);
  }, [loading]);
  useEffect(() => {
    setRefreshNote(null);
  }, [response]);
  const title = flight ? `${flight.airline} ${flight.flightNumber}` : 'Flight status';
  const subtitle = flight && lookup ? `${flight.from} → ${flight.to} · ${shortDate(lookup.date)}` : null;
  const tone = status ? STATE_TONE[status.state] : null;

  const side = (label: string, code: string, m: Movement) => {
    const tz = AIRPORTS[code]?.tz ?? 'UTC';
    const delayWord = delayText(m.delayMin);
    // The title already says "On time" for a scheduled flight; don't repeat it on each card.
    const delay = delayWord === 'On time' && status?.state === 'scheduled' ? null : delayWord;
    const lead = movementLead(m, tz);
    return (
      <View
        key={label}
        accessible
        accessibilityLabel={forSpeech([`${label}, ${code}`, delay, movementSpoken(m, tz), placeText(m)].filter(Boolean).join('. '))}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.top}>
          <Text style={[textStyles.number, { color: c.text }]}>{code}</Text>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>{label}</Text>
          {delay ? <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.trailing, { color: c.text }]}>{delay}</Text> : null}
        </View>
        {/* The time that matters now is full size; the scheduled one it replaced sits small and struck before it (John, 2026-10-30). */}
        {lead ? (
          <Text style={[textStyles.number, { color: c.text }]}>
            {lead.was ? (
              <Text style={[styles.leadMeta, { color: c.muted }]}>
                <Text style={styles.struck}>{lead.was.replace(/ /g, '\u00a0')}</Text>
                {'\u00a0'}
              </Text>
            ) : null}
            {lead.time.replace(/ /g, '\u00a0')}
            <Text style={[styles.leadMeta, { color: c.muted }]}>{`  ${lead.label}`}</Text>
          </Text>
        ) : null}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>{placeText(m)}</Text>
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
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>Flight status isn’t available right now.</Text>
              ) : null}
              {error === 'fetch_failed' && !response ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>{FETCH_FAILED_TEXT}</Text>
              ) : null}
              {loading && !response ? <ActivityIndicator accessibilityLabel="Loading flight status" /> : null}
              {response && !status ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
                  {response.state === 'unavailable' ? FETCH_FAILED_TEXT : 'No status for this flight yet.'}
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
                    <Text
                      style={[textStyles.title, { color: tone ? c[TONE_FG[tone]] : c.text }]}
                      maxFontSizeMultiplier={TITLE_MAX_SCALE}>
                      {STATE_WORD[status.state]}
                    </Text>
                  </View>
                  {side('Departs', flight.from, status.departure)}
                  {side('Arrives', flight.to, status.arrival)}
                </>
              ) : null}
              {/* How old the status is sits right under it: an old "Delayed" must say so before anything else. */}
              {response ? (
                <View style={styles.ageLine} accessible>
                  {response.stale ? (
                    <View style={styles.ageIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <Icon name="clock" size={14} tintColor={c.text} fallback={null} />
                    </View>
                  ) : null}
                  <Text style={[response.stale ? textStyles.bodyStrong : textStyles.small, styles.ageText, { color: response.stale ? c.text : c.muted }]}>
                    {ageText(response, now)}
                  </Text>
                </View>
              ) : null}
              {error === 'fetch_failed' && response ? (
                <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.text }]}>Couldn’t refresh just now; showing the last status.</Text>
              ) : null}
              {error !== 'not_configured' && !isSample ? (
                <View style={styles.refreshRow}>
                  <Pressable
                    onPress={() => {
                      // Inside the 2-minute wait a tap can't fetch: say so instead of doing nothing.
                      // "Just updated" only when the last answer really is fresh.
                      if (loading || refresh() !== false) return;
                      const note =
                        error || response?.stale ? 'Try again in a couple of minutes.' : 'Just updated. You can refresh again in a couple of minutes.';
                      setRefreshNote(note);
                      announce(note);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={loading ? 'Refreshing flight status' : 'Refresh flight status'}
                    accessibilityState={{ busy: loading }}
                    style={pressStyle(styles.refresh, 'link')}>
                    <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c.accent }]}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
                  </Pressable>
                  {refreshNote ? <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.ageText, { color: c.muted }]}>{refreshNote}</Text> : null}
                </View>
              ) : null}
              {load && flight ? (
                <LoadCard load={load} now={now} focus={backFromReport} onReport={() => setReporting(true)} />
              ) : null}
              {flight ? <LogFlightLink flight={flight} now={now} /> : null}
              {/* The 2-minute wait is said when you tap Refresh too soon, so it isn't repeated here. */}
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>Times are local to each airport.</Text>
              {/* The source line names a real feed, so it shows only for live status (round 30: no sample labels). */}
              {isSample ? null : <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>Data from AeroDataBox.</Text>}
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
  const { reportWindow, askState, yourReport, onAsk, askAnswer, onCancelAsk, fromTrips } = load;
  const note = askState === 'asked' && fromTrips ? 'Waiting for an answer.' : askNote(askState);
  const answerTierWord = askAnswer ? answerTier(askAnswer) : null;
  const headerRef = useFocusOnMount(focus);
  const canReport = reportWindow === 'open';
  const closed = reportClosedNote(reportWindow);
  const tier = yourReport ? answerTier(yourReport) : null;
  const asked = askState === 'asked';
  // After Cancel Request the link goes away: VoiceOver moves to the note above Ask for Load.
  const [canceled, setCanceled] = useState(false);
  const noteRef = useFocusOnMount(canceled && askState === 'ready');
  // Once focus has moved, forget the cancel so a later change doesn't pull focus again.
  useEffect(() => {
    if (!canceled || askState !== 'ready') return;
    const t = setTimeout(() => setCanceled(false), 300);
    return () => clearTimeout(t);
  }, [canceled, askState]);
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
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c[TIER_FG[tier]] }]}>{TIER_WORD[tier]}</Text>
          {` · ${yourReport.open} open · ${yourReport.listed} listed · ${formatAge(yourReport.at, now)}`}
        </Text>
      ) : null}
      {closed || !yourReport ? (
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
          {closed ?? 'Seen the board? Report the open seats and the standby list.'}
        </Text>
      ) : null}
      <Button label={yourReport ? 'Report Again' : 'Report Load'} onPress={onReport} disabled={!canReport} />
      <View style={[styles.loadRule, { backgroundColor: c.line }]} />
      {askAnswer && answerTierWord ? (
        // Answered: the numbers take the place of the ask button.
        <Text
          style={[textStyles.body, { color: c.text }]}
          accessibilityLabel={forSpeech(`Your request was answered: ${answerText(askAnswer)} · ${formatAge(askAnswer.at, now)}`)}>
          {'Answered: '}
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, { color: c[TIER_FG[answerTierWord]] }]}>{TIER_WORD[answerTierWord]}</Text>
          {` · ${askAnswer.open} open · ${askAnswer.listed} listed · ${formatAge(askAnswer.at, now)}`}
        </Text>
      ) : (
        <>
          <Text ref={noteRef} style={[textStyles.body, { color: c.muted }]}>
            {note}
          </Text>
          <Button
            label={asked ? 'Asked' : 'Ask for Load'}
            kind="secondary"
            icon={asked ? 'checkmark' : undefined}
            onPress={() => {
              setCanceled(false);
              onAsk();
            }}
            disabled={askState !== 'ready'}
            accessibilityHint={asked ? 'Waiting for an answer' : undefined}
            // Asked is a confirmation, not an unavailable button: keep it full strength.
            style={asked ? styles.undimmed : undefined}
          />
          {asked && onCancelAsk ? (
            <Pressable
              onPress={() => {
                setCanceled(true);
                onCancelAsk();
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel Request"
              accessibilityHint="Frees one of your 5 requests"
              style={pressStyle(styles.cancelAsk, 'link')}>
              {/* Regular weight: quieter than the buttons above it. */}
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.accent }]}>Cancel Request</Text>
            </Pressable>
          ) : null}
        </>
      )}
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
  leadMeta: { fontFamily: textStyles.small.fontFamily, fontSize: textStyles.small.fontSize },
  struck: { textDecorationLine: 'line-through' },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  refreshRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.section },
  ageLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  ageIcon: { marginTop: 3 },
  ageText: { flexShrink: 1 },
  load: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.rowX, gap: spacing.group },
  loadRule: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  undimmed: { opacity: 1 },
  cancelAsk: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
});
