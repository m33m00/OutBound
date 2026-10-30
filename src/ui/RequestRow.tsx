import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { answerTier, requestDetail, requestTitle, type LoadRequest } from '@/requests/requests';
import { forSpeech } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { pressStyle } from './press';
import { TIER_FG, TIER_MARK } from './tierColors';

export interface RequestRowProps {
  request: LoadRequest;
  now: number;
  /** Your own ask (My Trips): shows Answered / Waiting instead of an Answer button. */
  mine?: boolean;
  /** Feed: open the report sheet for this flight. */
  onAnswer?: () => void;
  /** My Trips: the whole row opens the flight (status, seats, cancel; round 34). */
  onOpen?: () => void;
}

/** From this text size the button or badge moves under the text, so the flight never squeezes. */
const STACK_AT_FONT_SCALE = 1.3;

/**
 * One load request (DECISIONS.md "Reports and requests"): flight and route,
 * when it leaves and when it was asked; once answered, the tier word with
 * both numbers in the tier color (Q-065). Askers are never named.
 */
export function RequestRow({ request, now, mine, onAnswer, onOpen }: RequestRowProps) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_AT_FONT_SCALE;
  const title = requestTitle(request);
  const detail = requestDetail(request, now);
  const answered = request.answer != null;
  const tier = request.answer ? answerTier(request.answer) : null;
  const status = mine ? (answered ? 'Answered' : 'Waiting') : null;
  // The detail already says "answered 2m ago", so VoiceOver only adds Waiting.
  const spokenStatus = status === 'Waiting' ? status : null;
  const label = forSpeech([title, detail, spokenStatus].filter(Boolean).join('. '));
  const body = (
    <>
      <View
        style={stacked ? styles.textStacked : styles.text}
        accessible={!onOpen}
        accessibilityLabel={onOpen ? undefined : label}>
        <Text style={[textStyles.heading, { color: c.text }]}>{title}</Text>
        <View style={styles.detailLine}>
          {tier ? <View style={[styles.dot, { backgroundColor: c[TIER_MARK[tier]] }]} /> : null}
          <Text style={[textStyles.small, styles.detail, { color: tier ? c[TIER_FG[tier]] : c.muted }]}>{detail}</Text>
        </View>
      </View>
      {status ? (
        <View
          style={[styles.badge, stacked && styles.selfStart, { backgroundColor: answered ? c.accentSoft : c.surface2 }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden>
          <Text style={[textStyles.small, { color: answered ? c.accent : c.muted }]}>{status}</Text>
        </View>
      ) : null}
      {!mine && !answered && onAnswer ? (
        <Pressable
          onPress={onAnswer}
          accessibilityRole="button"
          accessibilityLabel={`Answer ${forSpeech(title)}`}
          accessibilityHint="Opens Report Load"
          testID="answer-request"
          style={pressStyle([styles.answer, stacked && styles.selfStart, { backgroundColor: c.accent }])}>
          <Text style={[textStyles.button, { color: c.onAccent }]}>Answer</Text>
        </Pressable>
      ) : null}
      {onOpen ? (
        <View style={stacked ? styles.chevronStacked : undefined}>
          <Icon name="chevron.right" size={14} tintColor={c.muted} fallback={null} />
        </View>
      ) : null}
    </>
  );
  if (onOpen) {
    return (
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens flight status and seats"
        testID="request-row"
        style={pressStyle([styles.row, stacked && styles.stacked])}>
        {body}
      </Pressable>
    );
  }
  return (
    <View style={[styles.row, stacked && styles.stacked]} testID="request-row">
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.section,
    paddingHorizontal: spacing.rowX,
    paddingVertical: spacing.rowY,
    minHeight: minTapTarget + spacing.rowY,
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.group },
  text: { flex: 1, gap: 2 },
  textStacked: { gap: 2, paddingRight: 20 },
  selfStart: { alignSelf: 'flex-start' },
  // Large text: the chevron stays, at the row's top right, so the row still reads as tappable.
  chevronStacked: { position: 'absolute', top: spacing.rowY + 4, right: spacing.rowX },
  // Dot sits on the first line when the detail wraps.
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detail: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  answer: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.page,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
