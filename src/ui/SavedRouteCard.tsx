import { Pressable, StyleSheet, Text, View } from 'react-native';

import { forSpeech } from '@/search/format';
import {
  elevation,
  fonts,
  InkContext,
  inkColors,
  minTapTarget,
  radius,
  spacing,
  textStyles,
  useColors,
  useColorSchemeName,
} from '@/theme';
import { savedRouteFlights, savedRouteTitle, savedRouteWhen, type SavedRoute } from '@/trips/savedRoutes';

import { Icon } from './Icon';
import { MetaLine } from './MetaLine';
import { pressStyle } from './press';
import { ScalePressable } from './ScalePressable';
import { StatusTag } from './StatusTag';
import { TicketTear } from './TicketTear';

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
  const scheme = useColorSchemeName();
  const title = savedRouteTitle(route);
  const when = savedRouteWhen(route, now);
  const flights = savedRouteFlights(route);
  const shortWhen = when.split(' · ')[0];
  const pastNote = 'Day passed. Opens today’s search.';
  const ink = inkColors[scheme];
  return (
    // A saved route is a floating card with a subtle boarding pass tear (rounds 120 and 121): the path
    // and the day up top, a perforation with notches, then the flights in mono.
    <View
      style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: c.line, shadowColor: c.text }]}
      testID="saved-route">
      <ScalePressable
        onPress={onOpen}
        scaleTo={0.985}
        pressedOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={forSpeech([title, when, `Flights ${flights}`, past ? pastNote : null].filter(Boolean).join('. '))}
        accessibilityHint={past ? 'Searches today' : 'Searches this day again'}>
        <InkContext.Provider value>
          <View style={[styles.stub, { backgroundColor: c.ink }]} testID="saved-route-stub">
            <Text lineBreakStrategyIOS="push-out" style={[textStyles.routeTitle, { color: past ? ink.muted : ink.text }]}>
              {title}
            </Text>
            <View style={styles.whenLine}>
              {/* The day and the times set apart by space, not a dot (round 123, John). */}
              <MetaLine text={when} textStyle={[textStyles.body, { color: ink.muted }]} testID="saved-route-when" />
              {past ? <StatusTag label="Passed" tone="gone" /> : null}
            </View>
          </View>
        </InkContext.Provider>
        <TicketTear notch={c.bg} edge={c.line} line={c.line2} />
        <View style={styles.body}>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.flights, { color: c.muted }]}>
            {flights}
          </Text>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Icon
              name="chevron.right"
              size={13}
              weight="semibold"
              tintColor={c.faint}
              fallback={<Text style={[textStyles.heading, { color: c.faint }]}>›</Text>}
            />
          </View>
        </View>
      </ScalePressable>
      {/* Its own button, apart from the card, so VoiceOver reaches it alone; it sits on the stub. */}
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
          tintColor={ink.muted}
          fallback={<Text style={[textStyles.small, { color: ink.muted }]}>Remove</Text>}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stub: {
    gap: 4,
    paddingTop: spacing.page,
    paddingBottom: spacing.page,
    paddingLeft: spacing.page,
    // Room for the trash button in the stub's top-right corner.
    paddingRight: minTapTarget + spacing.group,
    borderTopLeftRadius: radius.md - 1,
    borderTopRightRadius: radius.md - 1,
  },
  whenLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  shrink: { flexShrink: 1 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.group,
    paddingTop: 4,
    paddingBottom: spacing.page - 2,
    paddingHorizontal: spacing.page,
  },
  flights: { flex: 1, fontFamily: fonts.monoMedium },
  remove: {
    position: 'absolute',
    top: spacing.page - (minTapTarget - 28) / 2,
    right: 4,
    minWidth: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
