import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Flight } from '@/engine';
import { afterListText, answerTier, clampReport, departsText, MAX_LISTED, MAX_OPEN } from '@/requests/requests';
import { forSpeech, TIER_WORD } from '@/search/format';
import { fonts, minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';
import { selectionTick } from './haptics';
import { pressStyle } from './press';
import { SheetHeader } from './SheetHeader';
import { TIER_FG, TIER_MARK } from './tierColors';

/** Hold − or + this long before it starts repeating, then step this often (prototype v9.1). */
const REPEAT_DELAY_MS = 380;
const REPEAT_EVERY_MS = 70;

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
 * type), a live line with the tier and the seats left after the list, the
 * sharing notice, and Submit Report.
 */
export function ReportSheet({ flight, visible, now, onCancel, onSubmit }: ReportSheetProps) {
  const c = useColors();
  const [open, setOpen] = useState(0);
  const [listed, setListed] = useState(0);
  // Each flight starts from zero.
  const flightId = flight?.id;
  useEffect(() => {
    if (!flightId) return;
    setOpen(0);
    setListed(0);
  }, [flightId]);
  const tier = answerTier({ open, listed });
  const tierLine = `${TIER_WORD[tier]} · ${afterListText(open, listed)}`;
  const subtitle = flight ? `${flight.airline} ${flight.flightNumber} · ${flight.from} → ${flight.to}` : undefined;

  return (
    <Modal visible={visible ?? flight !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <SheetHeader title="Report Load" subtitle={subtitle} action="Cancel" onAction={onCancel} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {flight ? <Text style={[textStyles.body, { color: c.muted }]}>{departsText(flight, now)}</Text> : null}
          <NumberField
            label="Open seats"
            caption="On the board"
            value={open}
            max={MAX_OPEN}
            onChange={(v) => setOpen(clampReport('open', v))}
          />
          <NumberField
            label="Nonrevs listed"
            caption="On the standby list"
            value={listed}
            max={MAX_LISTED}
            onChange={(v) => setListed(clampReport('listed', v))}
          />
          <View
            style={[styles.tier, { backgroundColor: c.surface, borderColor: c.line }]}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={tierLine}
            testID="report-tier">
            <View style={[styles.dot, { backgroundColor: c[TIER_MARK[tier]] }]} />
            <Text style={[textStyles.heading, { color: c[TIER_FG[tier]] }]}>{TIER_WORD[tier]}</Text>
            <Text style={[textStyles.body, styles.after, { color: c.muted }]}>{afterListText(open, listed)}</Text>
          </View>
          <Text style={[textStyles.small, { color: c.muted }]}>
            Follow your airline’s rules on sharing loads. Reports are anonymous to other employees.
          </Text>
          <Button label="Submit Report" onPress={() => onSubmit(open, listed)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NumberField({
  label,
  caption,
  value,
  max,
  onChange,
}: {
  label: string;
  caption: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const [text, setText] = useState(String(value));
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!typing) setText(String(value));
  }, [value, typing]);
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
    if (next < 0 || next > max) return;
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
        accessibilityValue={{ text: String(value) }}
        accessibilityState={{ disabled }}
        style={pressStyle([styles.stepBtn, { backgroundColor: c.surface2, opacity: disabled ? 0.4 : 1 }])}>
        <Text style={[styles.stepText, { color: c.text }]}>{d > 0 ? '+' : '−'}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.field, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.fieldLabel}>
        <Text style={[textStyles.heading, { color: c.text }]}>{label}</Text>
        <Text style={[textStyles.small, { color: c.muted }]}>{caption}</Text>
      </View>
      <View style={styles.stepper}>
        {btn(-1)}
        <TextInput
          value={text}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '').slice(0, 3);
            setText(digits);
            if (digits) onChange(Number(digits));
          }}
          onFocus={() => setTyping(true)}
          onBlur={() => {
            setTyping(false);
            if (!text) onChange(0);
          }}
          selectTextOnFocus
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={3}
          accessibilityLabel={forSpeech(`${label}, ${caption}`)}
          accessibilityHint="Type a number"
          style={[styles.bignum, { color: c.text, borderColor: c.line }]}
        />
        {btn(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  body: { gap: spacing.section, paddingBottom: spacing.page * 2 },
  field: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.page,
    gap: spacing.section,
  },
  fieldLabel: { gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.section },
  stepBtn: {
    width: minTapTarget + 12,
    height: minTapTarget + 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 30 },
  bignum: {
    flex: 1,
    minHeight: minTapTarget + 12,
    textAlign: 'center',
    fontFamily: fonts.displayHeavy,
    fontSize: 40,
    lineHeight: 46,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 0,
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    padding: spacing.page,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  after: { flex: 1 },
});
