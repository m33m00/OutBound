import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIRPORTS, type Flight } from '@/engine';
import { answerText, answerTier, flightKey, type LoadAnswer } from '@/requests/requests';
import { formatAge, formatTime, forSpeech, TIER_WORD } from '@/search/format';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { pressStyle } from './press';
import { ReportForm } from './ReportSheet';
import { SheetHeader } from './SheetHeader';
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
  const announce = useAnnounceLater();
  useEffect(() => setPicked(null), [code]);

  const row = ({ item: f }: { item: Flight }) => {
    const tz = AIRPORTS[f.from]?.tz ?? 'UTC';
    const time = formatTime(f.departUtc, tz);
    const yours = reportFor(f);
    const tier = yours ? answerTier(yours) : null;
    const left = f.departUtc <= now;
    const detail = yours
      ? `You reported ${answerText(yours)} · ${formatAge(yours.at, now)}`
      : (AIRPORTS[f.to]?.name ?? f.to);
    return (
      <Pressable
        onPress={() => setPicked(f)}
        accessibilityRole="button"
        accessibilityLabel={forSpeech(`${left ? 'Left' : 'Departs'} ${time} · ${f.airline} ${f.flightNumber} to ${f.to} · ${detail}`)}
        accessibilityHint="Opens Report Load"
        testID="departure-row"
        style={pressStyle([styles.row, { borderBottomColor: c.line }])}>
        <Text style={[textStyles.number, styles.time, { color: left ? c.muted : c.text }]}>{time}</Text>
        <View style={styles.text}>
          <Text style={[textStyles.heading, { color: c.text }]}>{`${f.airline} ${f.flightNumber} to ${f.to}`}</Text>
          {yours && tier ? (
            <Text style={[textStyles.small, { color: c.text }]}>
              <Text style={{ color: c.youText }}>You reported </Text>
              <Text style={{ color: c[TIER_FG[tier]] }}>{TIER_WORD[tier]}</Text>
              {` · ${yours.open} open · ${yours.listed} listed · ${formatAge(yours.at, now)}`}
            </Text>
          ) : (
            <Text style={[textStyles.small, { color: c.muted }]} numberOfLines={2}>
              {detail}
            </Text>
          )}
        </View>
        <Icon name="chevron.right" size={14} tintColor={c.muted} fallback={null} />
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
            onCancel={() => setPicked(null)}
            onSubmit={(open, listed) => {
              onReport(picked, open, listed);
              setPicked(null);
              const said = forSpeech(`Reported ${picked.airline} ${picked.flightNumber}: ${answerText({ open, listed, at: now })}`);
              announce(said);
            }}
          />
        ) : (
          <>
            <SheetHeader
              title={code ? `Departures from ${code}` : 'Departures'}
              subtitle="Pick the flight on the board"
              action="Done"
              onAction={onClose}
            />
            <FlatList
              data={flights}
              keyExtractor={flightKey}
              renderItem={row}
              ListEmptyComponent={
                <Text style={[textStyles.body, { color: c.muted }]}>
                  {`No more departures from ${code ?? 'here'} in the next 5 hours.`}
                </Text>
              }
              contentContainerStyle={styles.list}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  list: { paddingBottom: spacing.page * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    minHeight: minTapTarget + spacing.rowY,
    paddingVertical: spacing.rowY,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  time: { minWidth: 76 },
  text: { flex: 1, gap: 2 },
});
