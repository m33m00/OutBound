import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, type Flight } from '@/engine';
import { answerText, answerTier, flightKey, type LoadAnswer } from '@/requests/requests';
import { formatAge, formatTime, forSpeech, TIER_WORD } from '@/search/format';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { pressStyle } from './press';
import { ReportForm } from './ReportSheet';
import { SheetHeader, TITLE_MAX_SCALE } from './SheetHeader';
import { TIER_FG } from './tierColors';
import { useAnnounceLater } from './useAnnounceLater';

export interface DeparturesSheetProps {
  /** Airport you're at; null = closed. */
  code: string | null;
  visible?: boolean;
  flights: Flight[];
  now: number;
  reportFor: (f: Flight) => LoadAnswer | null;
  onReport: (f: Flight, open: number, listed: number) => void;
  onClose: () => void;
}

/**
 * Departures from the airport you're at (DECISIONS.md at-airport shortcut,
 * round 33): pick the flight on the board, then Report Load opens in the
 * same sheet. Back on the list, the flight shows what you reported.
 */
export function DeparturesSheet({ code, visible, flights, now, reportFor, onReport, onClose }: DeparturesSheetProps) {
  const c = useColors();
  const [picked, setPicked] = useState<Flight | null>(null);
  // Back from Report Load: VoiceOver lands on the list title again.
  const [back, setBack] = useState(false);
  const announce = useAnnounceLater();
  const { fontScale } = useWindowDimensions();
  const big = fontScale >= BIG_TEXT_SCALE;
  useEffect(() => {
    setPicked(null);
    setBack(false);
  }, [code]);
  const leaveReport = () => {
    setPicked(null);
    setBack(true);
  };

  const row = ({ item: f }: { item: Flight }) => {
    const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
    const time = formatTime(f.departUtc, tz);
    const yours = reportFor(f);
    const tier = yours ? answerTier(yours) : null;
    const left = f.departUtc <= now;
    const place = AIRPORTS[f.to]?.name ?? f.to;
    // Departed flights say so in words, not only in the muted time.
    const detail = yours
      ? `You reported ${answerText(yours)} · ${formatAge(yours.at, now)}`
      : left
        ? `Departed · ${place}`
        : place;
    return (
      <Pressable
        onPress={() => setPicked(f)}
        accessibilityRole="button"
        accessibilityLabel={forSpeech(`${left ? 'Departed' : 'Departs'} ${time} · ${f.airline} ${f.flightNumber} to ${f.to} · ${yours || !left ? detail : place}`)}
        accessibilityHint={yours ? 'Opens Report Load again' : 'Opens Report Load'}
        testID="departure-row"
        style={pressStyle([styles.row, big && styles.rowStacked, { borderBottomColor: c.line }])}>
        <Text
          style={[textStyles.number, !big && styles.time, { color: left ? c.muted : c.text }]}
          maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {time}
        </Text>
        <View style={[styles.text, big && styles.textStacked]}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>{`${f.airline} ${f.flightNumber} to ${f.to}`}</Text>
          {yours && tier ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.text }]}>
              <Text style={{ color: c.youText }}>You reported </Text>
              <Text style={{ color: c[TIER_FG[tier]], fontFamily: textStyles.bodyStrong.fontFamily }}>{TIER_WORD[tier]}</Text>
              {` · ${yours.open} open · ${yours.listed} listed · ${formatAge(yours.at, now)}`}
            </Text>
          ) : (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} numberOfLines={big ? undefined : 2}>
              {detail}
            </Text>
          )}
        </View>
        <View style={big && styles.chevronStacked}>
          <Icon name="chevron.right" size={14} tintColor={c.muted} fallback={null} />
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible ?? code !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        {picked ? (
          <ReportForm
            flight={picked}
            now={now}
            focusTitle
            onCancel={leaveReport}
            onSubmit={(open, listed) => {
              onReport(picked, open, listed);
              leaveReport();
              announce(forSpeech(`Reported ${picked.airline} ${picked.flightNumber}: ${answerText({ open, listed, at: now })}`));
            }}
          />
        ) : null}
        {/* The list stays mounted under Report Load, so you keep your place on a long board. */}
        <View style={[styles.page, picked && styles.hidden]}>
          <SheetHeader
            title={code ? `Departures from ${code}` : 'Departures'}
            subtitle="Pick your flight on the departure board"
            action="Done"
            onAction={onClose}
            focusTitle={back && !picked}
          />
          <FlatList
            data={flights}
            keyExtractor={flightKey}
            renderItem={row}
            ListEmptyComponent={
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.muted }]}>
                {`No more departures from ${code ?? 'here'} in the next 5 hours.`}
              </Text>
            }
            contentContainerStyle={styles.list}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** From this text size the time goes above the flight instead of in a column beside it. */
const BIG_TEXT_SCALE = 1.3;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  page: { flex: 1 },
  hidden: { display: 'none' },
  list: { paddingBottom: spacing.page * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    minHeight: minTapTarget + spacing.rowY,
    paddingVertical: spacing.rowY,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Big text: time on top, flight under it, chevron pinned at the right.
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, paddingRight: 24 },
  time: { minWidth: 76 },
  text: { flex: 1, gap: 2 },
  textStacked: { flex: 0, alignSelf: 'stretch' },
  chevronStacked: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
});
