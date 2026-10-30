import { StyleSheet, Text, View } from 'react-native';

import type { LegTagKind } from '@/search/statusTags';
import { fonts, radius, textStyles, useColors } from '@/theme';

import { Icon } from './Icon';
import { TONE_BG, TONE_FG, type Tone } from './statusTone';

/** Row tag kind to tone (Q-050). */
export const TAG_TONE: Record<LegTagKind, Tone> = {
  delayed: 'delayed',
  departed: 'gone',
  arrived: 'gone',
  canceled: 'canceled',
  diverted: 'canceled',
};

/** A live-status word on a row ("Delayed 25m", "Departed", "Canceled"), shared by results and requests. */
export function StatusTag({ label, tone }: { label: string; tone: Tone }) {
  const c = useColors();
  return (
    <View
      style={[styles.statusTag, { backgroundColor: c[TONE_BG[tone]], borderColor: tone === 'gone' ? c.line2 : c[TONE_BG[tone]] }]}>
      {/* Icon keeps Canceled / Diverted from reading as a Full-tier red edge; the word stays. */}
      {tone === 'canceled' ? (
        <Icon name="xmark.circle" size={12} tintColor={c[TONE_FG[tone]]} fallback={null} />
      ) : null}
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.shrink, { fontFamily: fonts.bodySemiBold, color: c[TONE_FG[tone]] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  statusTag: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
