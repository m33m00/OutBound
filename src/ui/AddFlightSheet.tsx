import { scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDate } from '@/engine';
import { parseBoardingPass, type PassLeg } from '@/logbook/bcbp';
import { loggedFrom, loggedId, typedFlightProblem, type LoggedFlight, type LogSource } from '@/logbook/logbook';
import { shortDate } from '@/search/dates';
import { minTapTarget, radius, spacing, textStyles, useColors, useColorSchemeName } from '@/theme';

import { Button } from './Buttons';
import { DatePickerModal } from './DatePickerModal';
import { Icon } from './Icon';
import { PASS_BARCODES, PassScanner } from './PassScanner';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';

export interface AddFlightSheetProps {
  visible: boolean;
  now: number;
  /** The flight is already in the logbook. */
  has: (id: string) => boolean;
  onAdd: (flights: LoggedFlight[]) => void;
  onClose: () => void;
}

type Note = { tone: 'ok' | 'warn'; text: string } | null;

/** Earliest day the calendar offers. */
const FIRST_DAY = '2000-01-01';

const phoneTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

/** Screenshots on iPhone can only be read when the pass uses a square QR code. */
export const PHOTO_MISS_IOS =
  'Couldn’t read a pass in that picture. Screenshots work when the pass has a square QR code. For other passes, scan it with the camera (a pass on another screen works) or type it in.';
export const PHOTO_MISS =
  'Couldn’t read a pass in that picture. Try scanning it with the camera, or type it in.';

/**
 * Add a flight to the logbook: scan the boarding pass, pick a screenshot of
 * one, or type it in. A scan fills the form so it can be checked first.
 */
export function AddFlightSheet({ visible, now, has, onAdd, onClose }: AddFlightSheetProps) {
  const c = useColors();
  const today = localDate(now, phoneTz());
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(today);
  const [seat, setSeat] = useState('');
  const [extra, setExtra] = useState<PassLeg[]>([]);
  const [source, setSource] = useState<LogSource>('manual');
  const [note, setNote] = useState<Note>(null);
  const [scanning, setScanning] = useState(false);
  const [picking, setPicking] = useState(false);
  const [datePicker, setDatePicker] = useState(false);

  // Each time it opens: a clean form on today.
  useEffect(() => {
    if (!visible) return;
    setAirline('');
    setFlightNumber('');
    setFrom('');
    setTo('');
    setDate(localDate(Date.now(), phoneTz()));
    setSeat('');
    setExtra([]);
    setSource('manual');
    setNote(null);
  }, [visible]);

  const fill = (legs: PassLeg[], how: LogSource) => {
    const [first, ...rest] = legs;
    setAirline(first.airline);
    setFlightNumber(first.flightNumber);
    setFrom(first.from);
    setTo(first.to);
    setDate(first.date);
    setSeat(first.seat ?? '');
    setExtra(rest);
    setSource(how);
    setNote({ tone: 'ok', text: 'Read your boarding pass. Check it, then add it.' });
  };

  const pickScreenshot = async () => {
    setPicking(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const uri = res.canceled ? null : res.assets?.[0]?.uri;
      if (!uri) return;
      const found = await scanFromURLAsync(uri, [...PASS_BARCODES]).catch(() => []);
      const legs = found.map((b) => parseBoardingPass(b.data, now)).find((l) => l != null);
      if (legs) fill(legs, 'photo');
      else setNote({ tone: 'warn', text: Platform.OS === 'ios' ? PHOTO_MISS_IOS : PHOTO_MISS });
    } catch {
      setNote({ tone: 'warn', text: PHOTO_MISS });
    } finally {
      setPicking(false);
    }
  };

  const typed = { airline, flightNumber, from, to };
  const id = loggedId({ ...typed, date });
  const problem = typedFlightProblem(typed) ?? (has(id) ? 'This flight is already in your logbook.' : null);
  const started = Boolean(airline || flightNumber || from || to);
  const count = 1 + extra.length;

  const add = () => {
    if (problem) return;
    const first: PassLeg = { ...typed, date, seat: seat || undefined };
    onAdd([first, ...extra].map((leg) => loggedFrom(leg, source, Date.now())));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title="Add Flight" action="Cancel" onAction={onClose} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={styles.ways}>
            <WayButton icon="barcode.viewfinder" label="Scan Boarding Pass" onPress={() => setScanning(true)} />
            <WayButton
              icon="photo.on.rectangle"
              label="Choose Screenshot"
              onPress={pickScreenshot}
              disabled={picking}
              hint="Reads the barcode in a picture of your pass"
            />
          </View>
          {note ? (
            <Text
              lineBreakStrategyIOS="push-out"
              accessibilityLiveRegion="polite"
              testID="add-flight-note"
              style={[textStyles.small, { color: note.tone === 'ok' ? c.goodFg : c.tightFg }]}>
              {note.text}
            </Text>
          ) : null}

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={styles.pair}>
              <Field label="Airline" value={airline} onChangeText={(t) => setAirline(clean(t, 3))} placeholder="AA" maxLength={3} />
              <Field
                label="Flight"
                value={flightNumber}
                onChangeText={(t) => setFlightNumber(clean(t, 5))}
                placeholder="1234"
                maxLength={5}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              />
            </View>
            <View style={styles.pair}>
              <Field label="From" value={from} onChangeText={(t) => setFrom(letters(t))} placeholder="DFW" maxLength={3} />
              <Field label="To" value={to} onChangeText={(t) => setTo(letters(t))} placeholder="LAX" maxLength={3} />
            </View>
            <View style={styles.pair}>
              <View style={styles.field}>
                <Text style={[textStyles.small, { color: c.muted }]}>Date</Text>
                <Pressable
                  onPress={() => setDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Date, ${shortDate(date)}`}
                  accessibilityHint="Opens a calendar"
                  testID="add-flight-date"
                  style={pressStyle([styles.input, styles.dateBox, { borderColor: c.line, backgroundColor: c.bg }])}>
                  <Text style={[textStyles.bodyStrong, { color: c.text }]}>{shortDate(date)}</Text>
                  <Icon name="calendar" size={15} tintColor={c.muted} fallback={null} />
                </Pressable>
              </View>
              <Field label="Seat (optional)" value={seat} onChangeText={(t) => setSeat(clean(t, 4))} placeholder="12A" maxLength={4} />
            </View>
          </View>

          {extra.length ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="add-flight-extra">
              {`Also on this pass: ${extra.map((l) => `${l.from} → ${l.to}, ${l.airline} ${l.flightNumber}`).join('; ')}`}
            </Text>
          ) : null}

          <Button
            label={count > 1 ? `Add ${count} Flights` : 'Add to Logbook'}
            onPress={add}
            disabled={problem != null}
            accessibilityHint={problem ?? undefined}
          />
          {started && problem ? (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]} testID="add-flight-problem">
              {problem}
            </Text>
          ) : null}
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            Your logbook stays on this phone. Only the flight is kept from a pass, never your name or booking code.
          </Text>
        </ScrollView>
        <PassScanner
          visible={scanning}
          now={now}
          onClose={() => setScanning(false)}
          onScanned={(legs) => {
            setScanning(false);
            fill(legs, 'scan');
          }}
        />
        <DatePickerModal
          visible={datePicker}
          title="Flight Date"
          date={date}
          min={FIRST_DAY}
          max={date > today ? date : today}
          note="The day the flight left."
          onPick={setDate}
          onClose={() => setDatePicker(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

/** Capitals and digits only, cut to `max`. */
const clean = (t: string, max: number) => t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
const letters = (t: string) => t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

function Field({ label, ...input }: { label: string } & TextInputProps) {
  const c = useColors();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.field}>
      <Text style={[textStyles.small, { color: c.muted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        {...input}
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        keyboardAppearance={scheme}
        placeholderTextColor={c.faint}
        accessibilityLabel={label}
        style={[textStyles.bodyStrong, styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.bg }]}
      />
    </View>
  );
}

function WayButton({
  icon,
  label,
  onPress,
  disabled,
  hint,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      style={pressStyle([styles.way, { backgroundColor: c.surface, borderColor: c.line, opacity: disabled ? 0.5 : 1 }])}>
      <Icon name={icon} size={26} tintColor={c.accent} fallback={null} />
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.bodyStrong, styles.wayText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page * 2 },
  ways: { flexDirection: 'row', gap: spacing.section },
  way: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.group,
    padding: spacing.page,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: minTapTarget * 2,
    justifyContent: 'center',
  },
  wayText: { textAlign: 'center' },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.page,
    gap: spacing.section,
  },
  pair: { flexDirection: 'row', gap: spacing.section },
  field: { flex: 1, gap: 4 },
  input: {
    minHeight: minTapTarget,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.rowX,
    paddingVertical: 0,
  },
  dateBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
