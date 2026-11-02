import { Pressable, StyleSheet, Text, View } from 'react-native';

import { forSpeech } from '@/search/format';
import { elevation, minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { savedRouteFlights, savedRouteTitle, savedRouteWhen, type SavedRoute } from '@/trips/savedRoutes';

import { Icon } from './Icon';
import { pressStyle } from './press';
import { StatusTag } from './StatusTag';

export interface SavedRouteCardProps {
  route: SavedRoute;
  /** Its day has passed; opening searches today instead. */
  past: boolean;
  /** Clock for "Today" and "Tomorrow". */
  now: number;
  onOpen: () => void;
  onRemove: () => void;
}

/**
 * One saved route in My Trips (Q-043): path, day and times, flight numbers.
 * Tapping searches that day again; the trash button sits apart so VoiceOver
 * reaches it on its own, and asks before removing. A day that passed gets a
 * gray Passed tag beside its day, like the tags on list rows, in place of a
 * sentence (round 71); VoiceOver still says it opens today's search.
 */
export function SavedRouteCard({ route, past, now, onOpen, onRemove }: SavedRouteCardProps) {
  const c = useColors();
  const title = savedRouteTitle(route);
  const when = savedRouteWhen(route, now);
  const flights = savedRouteFlights(route);
  const shortWhen = when.split(' · ')[0];
  const pastNote = 'Day passed. Opens today’s search.';
  return (
    <View
      style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: c.line, shadowColor: c.text }]}
      testID="saved-route">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={forSpeech([title, when, `Flights ${flights}`, past ? pastNote : null].filter(Boolean).join('. '))}
        accessibilityHint={past ? 'Searches today' : 'Searches this day again'}
        style={pressStyle(styles.main)}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: past ? c.muted : c.text }]}>
          {title}
        </Text>
        <View style={styles.whenLine}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, styles.shrink, { color: c.muted }]}>
            {when}
          </Text>
          {past ? <StatusTag label="Passed" tone="gone" /> : null}
        </View>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
          {flights}
        </Text>
      </Pressable>
      <View style={styles.chevron} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Icon
          name="chevron.right"
          size={13}
          weight="semibold"
          tintColor={c.faint}
          fallback={<Text style={[textStyles.heading, { color: c.faint }]}>›</Text>}
        />
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${forSpeech(title)}, ${forSpeech(shortWhen)}`}
        hitSlop={{ right: spacing.group }}
        testID="remove-saved-route"
        style={pressStyle(styles.remove, 'link')}>
        <Icon
          name="trash"
          size={18}
          tintColor={c.muted}
          fallback={<Text style={[textStyles.small, { color: c.muted }]}>Remove</Text>}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, gap: 2, padding: spacing.page, paddingRight: spacing.group },
  whenLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  shrink: { flexShrink: 1 },
  chevron: { alignSelf: 'center' },
  remove: {
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.page - (minTapTarget - 22) / 2,
    marginRight: 4,
  },
});
