import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIMITS, type SearchFilters } from '@/settings/settings';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Stepper } from './Stepper';
import { pressStyle } from './press';

/** Search filter controls, shared by the Filters panel and Settings. */
export function FiltersForm({ filters: f, onChange }: { filters: SearchFilters; onChange: (f: SearchFilters) => void }) {
  const c = useColors();
  const set = (patch: Partial<SearchFilters>) => onChange({ ...f, ...patch });
  return (
    <View style={styles.form}>
      <Text style={[textStyles.heading, { color: c.text }]}>Max stops</Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {[0, 1, 2, 3].map((n) => {
          const on = f.maxStops === n;
          return (
            <Pressable
              key={n}
              onPress={() => set({ maxStops: n })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={n === 0 ? 'Nonstop only' : `Up to ${n} ${n === 1 ? 'stop' : 'stops'}`}
              style={pressStyle([styles.segment, { backgroundColor: on ? c.accent : c.surface2 }])}>
              <Text style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.text }]}>
                {n === 0 ? 'Nonstop' : n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[textStyles.heading, { color: c.text }]}>Connections</Text>
      <Stepper
        label="Same airline, at least"
        value={f.minConnectSameAirlineMin}
        {...LIMITS.minConnectSameAirlineMin}
        onChange={(v) => set({ minConnectSameAirlineMin: v })}
      />
      <Stepper
        label="Switching airlines, at least"
        value={f.minConnectSwitchMin}
        {...LIMITS.minConnectSwitchMin}
        onChange={(v) => set({ minConnectSwitchMin: v })}
      />
      <Stepper
        label="Longest layover"
        value={f.maxLayoverMin}
        {...LIMITS.maxLayoverMin}
        onChange={(v) => set({ maxLayoverMin: v })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.section },
  segments: { flexDirection: 'row', gap: spacing.group },
  segment: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
