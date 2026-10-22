import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AIRPORTS } from '@/engine';
import { QUICK_DATE_CHIPS, type DateChip } from '@/search/dates';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { DatePickerModal } from './DatePickerModal';
import { SampleLabel } from './ResultsPanel';

export interface SearchPanelProps {
  chips: readonly DateChip[];
  date: string;
  onDate: (date: string) => void;
  origin: string | null;
  destination: string | null;
  onPickOrigin: () => void;
  onPickDestination: () => void;
  onSwap: () => void;
  onFilters: () => void;
  /** How many filters differ from the defaults. */
  filtersChanged: number;
  onFind: () => void;
  /** Shown when away from home: To = main home, then search (Q-026). */
  onGetHome?: () => void;
  /** Shown when no main home is set yet. */
  onSetHome?: () => void;
}

function AirportCard({ label, code, onPress }: { label: string; code: string | null; onPress: () => void }) {
  const c = useColors();
  const name = code ? AIRPORTS[code]?.name : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={code ? `${label}: ${code}, ${name}. Change` : `${label}: choose an airport`}
      style={[styles.card, { backgroundColor: c.surface2 }]}>
      <Text style={[textStyles.small, { color: c.muted }]}>{label}</Text>
      <Text style={[textStyles.title, { color: code ? c.text : c.faint }]}>{code ?? '—'}</Text>
      <Text style={[textStyles.small, { color: c.muted }]} numberOfLines={1}>
        {name ?? 'Choose airport'}
      </Text>
    </Pressable>
  );
}

export function SearchPanel(p: SearchPanelProps) {
  const c = useColors();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const quick = p.chips.slice(0, QUICK_DATE_CHIPS);
  // A day past the chips shows on the calendar button itself.
  const later = p.chips.slice(QUICK_DATE_CHIPS).find((chip) => chip.date === p.date);
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.sampleRow}>
        <SampleLabel />
      </View>
      {/* One row, no sideways scroll: date chips share the width, calendar stays 44pt until it holds a date. */}
      <View style={styles.chips}>
        {quick.map((chip) => {
          const on = chip.date === p.date;
          return (
            <Pressable
              key={chip.date}
              onPress={() => p.onDate(chip.date)}
              accessibilityRole="button"
              accessibilityLabel={chip.long}
              accessibilityState={{ selected: on }}
              style={[styles.chip, styles.dateChip, { backgroundColor: on ? c.accent : c.surface2 }]}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.text }]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={later ? `${later.long}. Change date` : 'Pick a later date'}
          accessibilityState={{ selected: !!later }}
          style={[
            styles.chip,
            styles.calendar,
            later ? styles.dateChip : null,
            { backgroundColor: later ? c.accent : c.surface2 },
          ]}>
          <SymbolView
            name="calendar"
            size={18}
            tintColor={later ? c.onAccent : c.text}
            fallback={later ? null : <Text style={[textStyles.bodyStrong, { color: c.text }]}>Date</Text>}
          />
          {later ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[textStyles.bodyStrong, { color: c.onAccent }]}>
              {later.label}
            </Text>
          ) : null}
        </Pressable>
      </View>
      <DatePickerModal
        visible={calendarOpen}
        date={p.date}
        min={p.chips[0].date}
        max={p.chips[p.chips.length - 1].date}
        onPick={p.onDate}
        onClose={() => setCalendarOpen(false)}
      />

      <View style={styles.cards}>
        <AirportCard label="From" code={p.origin} onPress={p.onPickOrigin} />
        <Pressable
          onPress={p.onSwap}
          accessibilityRole="button"
          accessibilityLabel="Swap from and to"
          style={[styles.swap, { backgroundColor: c.surface, borderColor: c.line }]}>
          <SymbolView
            name="arrow.left.arrow.right"
            size={18}
            tintColor={c.accent}
            fallback={<Text style={[textStyles.heading, { color: c.accent }]}>⇄</Text>}
          />
        </Pressable>
        <AirportCard label="To" code={p.destination} onPress={p.onPickDestination} />
      </View>

      {p.onGetHome ? (
        <Button label="Get Home" kind="secondary" onPress={p.onGetHome} accessibilityLabel="Get Home: search to your main home" />
      ) : null}
      {p.onSetHome ? (
        <Pressable onPress={p.onSetHome} accessibilityRole="button" style={styles.hint}>
          <Text style={[textStyles.small, { color: c.accent }]}>Set your home airport in Profile ›</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={p.filtersChanged ? `Filters (${p.filtersChanged})` : 'Filters'}
          icon="line.3.horizontal.decrease.circle"
          kind="secondary"
          onPress={p.onFilters}
        />
        <Button
          label="Find Routes"
          onPress={p.onFind}
          disabled={!p.origin || !p.destination || p.origin === p.destination}
          style={styles.find}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page, gap: spacing.section },
  sampleRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  chips: { flexDirection: 'row', gap: spacing.group },
  chip: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  dateChip: { flex: 1, paddingHorizontal: 6, alignItems: 'center' },
  calendar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: minTapTarget },
  cards: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  card: { flex: 1, borderRadius: radius.md, padding: spacing.rowX, minHeight: minTapTarget },
  swap: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: minTapTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.group },
  find: { flex: 1 },
  hint: { minHeight: minTapTarget, justifyContent: 'center' },
});
