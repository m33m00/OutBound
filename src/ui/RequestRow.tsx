import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { answerTier, requestDetail, requestTitle, type LoadRequest } from '@/requests/requests';
import { forSpeech } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { pressStyle } from './press';
import { TIER_FG, TIER_MARK } from './tierColors';

export interface RequestRowProps {
  request: LoadRequest;
  now: number;
  /** Your own ask (My Trips): shows Answered / Waiting instead of an Answer button. */
  mine?: boolean;
  /** Feed: open the report sheet for this flight. */
  onAnswer?: () => void;
}

/** From this text size the button or badge moves under the text, so the flight never squeezes. */
const STACK_AT_FONT_SCALE = 1.3;

/**
 * One load request (DECISIONS.md "Reports and requests"): flight and route,
 * when it leaves and when it was asked; once answered, the tier word with
 * both numbers in the tier color (Q-065). Askers are never named.
 */
export function RequestRow({ request, now, mine, onAnswer }: RequestRowProps) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_AT_FONT_SCALE;
  const title = requestTitle(request);
  const detail = requestDetail(request, now);
  const answered = request.answer != null;
  const tier = request.answer ? answerTier(request.answer) : null;
  const status = mine ? (answered ? 'Answered' : 'Waiting') : null;
  return (
    <View style={[styles.row, stacked && styles.stacked]} testID="request-row">
      <View
        style={stacked ? styles.textStacked : styles.text}
        accessible
        accessibilityLabel={forSpeech([title, detail, status].filter(Boolean).join('. '))}>
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
  textStacked: { gap: 2 },
  selfStart: { alignSelf: 'flex-start' },
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
