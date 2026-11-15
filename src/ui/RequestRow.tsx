import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  answerTier,
  liveRequestDetail,
  requestDepartsLine,
  requestDetail,
  requestTitle,
  type LoadRequest,
} from '@/requests/requests';
import { formatAge, forSpeech } from '@/search/format';
import type { LegStatusView } from '@/search/statusTags';
import { fonts, minTapTarget, spacing, textStyles, useColors } from '@/theme';

import { AirlineMark } from './AirlinePill';
import { PillButton } from './Buttons';
import { Icon } from './Icon';
import { Divided, INLINE_DIVIDER } from './MetaLine';
import { pressStyle } from './press';
import { StatusTag, TAG_TONE } from './StatusTag';
import { SeatCountPill } from './SeatCountPill';

export interface RequestRowProps {
  request: LoadRequest;
  now: number;
  /** Your own ask (My Trips): shows Answered / Waiting instead of an Answer button. */
  mine?: boolean;
  /** Feed: open the report sheet for this flight. */
  onAnswer?: () => void;
  /** My Trips: the whole row opens the flight (status, seats, cancel; round 34). */
  onOpen?: () => void;
  /** Live status of the flight (My Trips): a delay, departure or cancel shows on the row (round 50). */
  leg?: LegStatusView | null;
}

/** How far the flight number and market may shrink to stay on one line (round 217). */
const TITLE_MIN_SCALE = 0.7;

/** From this text size the button or badge moves under the text, so the flight never squeezes. */
const STACK_AT_FONT_SCALE = 1.3;

/**
 * One load request (DECISIONS.md "Reports and requests"): flight and route,
 * when it leaves and when it was asked; once answered, the tier word with
 * both numbers in the tier color (Q-065). Askers are never named.
 */
export function RequestRow({ request, now, mine, onAnswer, onOpen, leg }: RequestRowProps) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_AT_FONT_SCALE;
  const title = requestTitle(request);
  const detail = requestDetail(request, now);
  const answered = request.answer != null;
  const tier = request.answer ? answerTier(request.answer) : null;
  const status = mine ? (answered ? 'Answered' : 'Waiting') : null;
  const spokenStatus = status;
  // Waiting: the old time struck, then the new time that matters now.
  const tag = leg?.tag ?? null;
  const live = liveRequestDetail(
    request,
    now,
    tag && leg ? { kind: tag.kind, scheduledText: leg.scheduledText, newUtc: leg.newUtc } : null,
  );
  // Answered rows show the tier line, so the new time rides on the tag instead.
  const tagLabel = tag && answered && leg?.newText ? `${tag.label}, now ${leg.newText}` : tag?.label;
  // The detail line already says the new and old times, so the tag only adds the delay; a canceled flight's
  // line keeps its own time, so the tag only adds Canceled.
  const tagSpoken = tag
    ? (live && tag.kind === 'delayed') || tag.kind === 'canceled'
      ? tag.spoken.split(', was ')[0]
      : tag.spoken
    : null;
  const label = forSpeech([title, live ? live.spoken : detail, tagSpoken, spokenStatus].filter(Boolean).join('. '));
  // When it was asked, on the same line as the flight's day and time (round 216). An answered ask shows no time
  // stamp at all (round 217, John: "remove the timestamp of when it was answered").
  const age = request.answer ? null : `asked ${formatAge(request.askedAt, now)}`;
  const divider = <Text style={[textStyles.small, { color: c.line2 }]}>{INLINE_DIVIDER}</Text>;
  const body = (
    <>
      {/* The same round airline badge as the tickets (round 164). */}
      {/* At big text the rows stack, and the badge leads the stack. */}
      <View style={styles.mark} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <AirlineMark airline={request.flight.airline} size={30} />
      </View>
      <View
        style={stacked ? styles.textStacked : styles.text}
        accessible={!onOpen}
        accessibilityLabel={onOpen ? undefined : label}>
        {/* Flight number and market stay on one line, shrinking a little to fit rather than wrapping (round 217,
            John: "Can we make sure it doesn't wrap?"). */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={TITLE_MIN_SCALE}
          style={[textStyles.heading, { color: c.text }]}
          testID="request-title">
          <Divided text={title} fontSize={textStyles.heading.fontSize} />
        </Text>
        <View style={styles.detailLine}>
          {/* The day and time it leaves, then when it was asked (round 216); answered asks show the day and time
              alone, like the others (round 217). */}
          <Text
            lineBreakStrategyIOS="push-out"
            style={[textStyles.small, styles.detail, { color: c.muted }]}
            testID="request-departs">
            {live ? (
              <>
                {live.prefix}
                {/* The old time sits struck before the new one (John, 2026-10-30). */}
                {live.struck ? <Text style={styles.struck}>{live.struck}</Text> : null}
                {live.time && live.struck ? '\u00a0' : null}
                {live.time ? <Text style={{ color: c.text, fontFamily: fonts.bodySemiBold }}>{live.time}</Text> : null}
              </>
            ) : (
              requestDepartsLine(request, now)
            )}
            {age ? (
              <>
                {divider}
                {age}
              </>
            ) : null}
          </Text>
        </View>
        {tag ? (
          <View style={styles.tagLine}>
            <StatusTag label={tagLabel ?? tag.label} tone={TAG_TONE[tag.kind]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.side, stacked && styles.sideStacked]} testID="request-side">
        {tier && request.answer ? (
          // The answer as the route line shows seats: seat and person icons over the numbers, in the seat color, in
          // one pill (round 164), sitting over the Answered pill (round 217, John: "Move the load count ... ontop of
          // the answered pill").
          <SeatCountPill open={request.answer.open} listed={request.answer.listed} tier={tier} testID="request-counts" />
        ) : null}
        {status ? (
          <View
            style={[styles.badge, { backgroundColor: answered ? c.goodBg : c.surface2 }]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden>
            <Text
              lineBreakStrategyIOS="push-out"
              style={[textStyles.small, styles.badgeText, { color: answered ? c.goodFg : c.muted }]}>
              {status}
            </Text>
          </View>
        ) : null}
        {!mine && !answered && onAnswer ? (
          // A light pill, not a filled button: the app keeps one filled main button (round 216).
          <PillButton
            label="Answer"
            onPress={onAnswer}
            accessibilityLabel={`Answer ${forSpeech(title)}`}
            accessibilityHint="Opens Report Load"
            testID="answer-request"
          />
        ) : null}
      </View>
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
  struck: { textDecorationLine: 'line-through' },
  tagLine: { flexDirection: 'row', marginTop: 4 },
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
  // Large text: the chevron stays, at the row's top right, so the row still reads as tappable.
  chevronStacked: { position: 'absolute', top: spacing.rowY + 4, right: spacing.rowX },
  detailLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  // The button or badge at the right edge.
  side: { alignItems: 'flex-end', gap: 6 },
  sideStacked: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  detail: { flexShrink: 1 },
  mark: { alignSelf: 'flex-start', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontFamily: fonts.bodySemiBold },
});
