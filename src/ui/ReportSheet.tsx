import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Flight } from '@/engine';
import { afterListText, answerTier, clampReport, departsText, MAX_LISTED, MAX_OPEN } from '@/requests/requests';
import { forSpeech } from '@/search/format';
import { fonts, minTapTarget, radius, spacing, textStyles, useColors, useColorSchemeName } from '@/theme';

import { Button, PillButton } from './Buttons';
import { selectionTick } from './haptics';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';
import { AirlineMark } from './AirlinePill';
import { useCardSurface } from './cardSurface';
import { Icon } from './Icon';
import { COUNT_ICON } from './MiniRoute';
import { TIER_BG, TIER_FG, TIER_MARK } from './tierColors';

/** Hold − or + this long before it starts repeating, then step this often (prototype v9.1). */
const REPEAT_DELAY_MS = 380;
const REPEAT_EVERY_MS = 70;
/** Big numbers stop growing past this text size so "200" never clips. */
const BIG_TEXT_MAX_SCALE = 1.3;
/** The number pad has no Return key on iPhone: a Done bar above it closes it. */
const KEYBOARD_BAR_ID = 'report-load-keyboard';
/** Wait for the numbers to settle before VoiceOver reads the new tier. */
const ANNOUNCE_AFTER_MS = 700;

export interface ReportSheetProps {
  /** Flight being reported; null = closed. */
  flight: Flight | null;
  /** Shown; defaults to having a flight. False while it slides away still showing its flight. */
  visible?: boolean;
  now: number;
  onCancel: () => void;
  onSubmit: (open: number, listed: number) => void;
}

/**
 * Report a load (DECISIONS.md "Reports and requests", v9.1 report screen):
 * two big number fields with − and + (hold to go faster, tap the number to
 * type), a live line with the tier and the seats left after the standby list, the
 * sharing notice, and Submit Report.
 */
export function ReportSheet({ flight, visible, now, onCancel, onSubmit }: ReportSheetProps) {
  const c = useColors();
  return (
    <Modal visible={visible ?? flight !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <ReportForm flight={flight} now={now} onCancel={onCancel} onSubmit={onSubmit} />
      </SafeAreaView>
    </Modal>
  );
}

export interface ReportFormProps {
  flight: Flight | null;
  now: number;
  onCancel: () => void;
  onSubmit: (open: number, listed: number) => void;
  /** Swapped in inside another sheet: VoiceOver starts on the title. */
  focusTitle?: boolean;
}

/**
 * The Report Load page itself (header, fields, Submit), as a sheet of its
 * own (Feed) or as a page inside the flight sheet (Search, round 32).
 */
export function ReportForm({ flight, now, onCancel, onSubmit, focusTitle }: ReportFormProps) {
  const c = useColors();
  const card = useCardSurface();
  const [open, setOpen] = useState(0);
  const [listed, setListed] = useState(0);
  // Nothing set yet: no tier shown and Submit stays off, so a stray tap can't report a false Full.
  const [touched, setTouched] = useState(false);
  // Each flight starts from zero.
  const flightId = flight?.id;
  useEffect(() => {
    if (!flightId) return;
    setOpen(0);
    setListed(0);
    setTouched(false);
  }, [flightId]);
  const tier = answerTier({ open, listed });
  const tierLine = touched ? afterListText(open, listed) : 'Set the numbers from the board';
  // iOS has no live regions: read the tier once the numbers stop moving.
  useEffect(() => {
    if (!touched) return;
    const t = setTimeout(() => AccessibilityInfo.announceForAccessibility(forSpeech(tierLine)), ANNOUNCE_AFTER_MS);
    return () => clearTimeout(t);
  }, [tierLine, touched]);
  const subtitle = flight ? `${flight.airline} ${flight.flightNumber} · ${flight.from} → ${flight.to}` : undefined;

  return (
    <>
      <SheetHeader
        title="Report Load"
        subtitle={subtitle}
        action="Cancel"
        onAction={() => {
          Keyboard.dismiss();
          onCancel();
        }}
        focusTitle={focusTitle}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        {flight ? (
          // The flight it's for, led by its round airline badge like everywhere else (round 165).
          <View style={styles.flightLine}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <AirlineMark airline={flight.airline} size={24} />
            </View>
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.after, { color: c.muted }]}>
              {departsText(flight, now)}
            </Text>
          </View>
        ) : null}
        <NumberField
          label="Seats left"
          icon={COUNT_ICON.seats}
          caption="On the departure board"
          value={open}
          max={MAX_OPEN}
          onChange={(v) => {
            setTouched(true);
            setOpen(clampReport('open', v));
          }}
        />
        <NumberField
          label="Nonrevs listed"
          icon={COUNT_ICON.listed}
          caption="On the standby list"
          value={listed}
          max={MAX_LISTED}
          onChange={(v) => {
            setTouched(true);
            setListed(clampReport('listed', v));
          }}
        />
        <View
          // Once you've typed, the box takes the seat color, like a route line (round 165).
          style={[card, styles.tier, touched && { backgroundColor: c[TIER_BG[tier]], borderColor: c[TIER_MARK[tier]] }]}
          accessible
          // Android reads a live region; iOS gets the announcement above (both would speak twice).
          accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
          accessibilityLabel={forSpeech(tierLine)}
          testID="report-tier">
          {touched ? (
            <>
              <View style={[styles.dot, { backgroundColor: c[TIER_MARK[tier]] }]} />
              <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c[TIER_FG[tier]] }]}>
                {afterListText(open, listed)}
              </Text>
            </>
          ) : (
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.after, { color: c.muted }]}>
              {tierLine}
            </Text>
          )}
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          Reports are anonymous to other employees.
        </Text>
        <Button
          label="Submit Report"
          haptic="success"
          disabled={!touched}
          accessibilityHint={touched ? undefined : 'Set seats left or nonrevs listed first'}
          onPress={() => {
            Keyboard.dismiss();
            onSubmit(open, listed);
          }}
        />
      </ScrollView>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
          <View style={[styles.keyboardBar, { backgroundColor: c.surface2, borderTopColor: c.line }]}>
            <PillButton label="Done" tone="filled" onPress={Keyboard.dismiss} style={styles.keyboardDone} />
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
}

function NumberField({
  label,
  icon,
  caption,
  value,
  max,
  onChange,
}: {
  label: string;
  /** The seat or person icon the route line uses for this count. */
  icon: SFSymbol;
  caption: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const card = useCardSurface();
  const scheme = useColorSchemeName();
  const [text, setText] = useState(String(value));
  // Keep the box in step with − / + and with the limit ("999" shows 200);
  // an empty box while typing counts as 0 and stays empty until you leave it.
  useEffect(() => {
    setText((t) => (Number(t || '0') === value ? t : String(value)));
  }, [value]);
  // Latest value for the hold-to-repeat timer.
  const valueRef = useRef(value);
  valueRef.current = value;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current != null) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const step = (d: 1 | -1) => {
    const next = valueRef.current + d;
    if (next < 0 || next > max) {
      // Held into a limit: the button turns off and may never get its press-out.
      stop();
      return;
    }
    valueRef.current = next;
    selectionTick();
    onChange(next);
  };

  const btn = (d: 1 | -1) => {
    const disabled = d < 0 ? value <= 0 : value >= max;
    return (
      <Pressable
        onPress={() => step(d)}
        onLongPress={() => {
          stop();
          timer.current = setInterval(() => step(d), REPEAT_EVERY_MS);
        }}
        delayLongPress={REPEAT_DELAY_MS}
        onPressOut={stop}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${d > 0 ? 'Increase' : 'Decrease'}: ${label}`}
        // VoiceOver stays on − or + and reads the new number from here.
        accessibilityValue={{ text: String(value) }}
        accessibilityState={{ disabled }}
        // Secondary buttons: the light tint with blue glyphs (round 139 rule, round 165).
        style={pressStyle([styles.stepBtn, { backgroundColor: c.accentSoft, opacity: disabled ? 0.4 : 1 }])}>
        <Text
          style={[styles.stepText, { fontFamily: fonts.bodyBold, color: c.accent }]}
          maxFontSizeMultiplier={BIG_TEXT_MAX_SCALE}>
          {d > 0 ? '+' : '−'}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[card, styles.field]}>
      {/* The number box says the label and caption, so VoiceOver skips them here. */}
      <View style={styles.fieldHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.fieldIcon, { backgroundColor: c.surface2 }]}>
          <Icon name={icon} size={16} tintColor={c.text} fallback={null} />
        </View>
        <View style={styles.fieldLabel}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]}>
            {label}
          </Text>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            {caption}
          </Text>
        </View>
      </View>
      <View style={styles.stepper}>
        {btn(-1)}
        <TextInput
          value={text}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '').slice(0, 3);
            setText(digits);
            onChange(digits ? Number(digits) : 0);
          }}
          onBlur={() => setText((t) => t || '0')}
          selectTextOnFocus
          keyboardType="number-pad"
          keyboardAppearance={scheme}
          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_BAR_ID : undefined}
          maxLength={3}
          maxFontSizeMultiplier={BIG_TEXT_MAX_SCALE}
          accessibilityLabel={forSpeech(`${label}, ${caption}`)}
          accessibilityHint={`Type a number from 0 to ${max}`}
          style={[styles.bignum, { fontFamily: fonts.mono, color: c.text, borderColor: c.line, backgroundColor: c.bg }]}
        />
        {btn(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page * 2 },
  field: { padding: spacing.page, gap: spacing.section },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.section },
  fieldIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { flex: 1, gap: 2 },
  flightLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.section },
  stepBtn: {
    width: minTapTarget + 12,
    height: minTapTarget + 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 26, lineHeight: 30 },
  bignum: {
    flex: 1,
    minHeight: minTapTarget + 12,
    textAlign: 'center',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 0,
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    padding: spacing.page,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  after: { flex: 1 },
  keyboardBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.page,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  keyboardDone: { marginVertical: 4 },
});
