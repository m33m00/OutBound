import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_SEARCH_OPTIONS, type SearchOptions } from '@/engine';
import { formatDuration } from '@/search/format';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';

/** The search settings people can adjust (DECISIONS.md: "All adjustable"). */
export type SearchFilters = Pick<
  SearchOptions,
  | 'maxStops'
  | 'minConnectSameAirlineMin'
  | 'minConnectSwitchMin'
  | 'maxLayoverMin'
  | 'nearbyAirports'
  | 'maxGroundTransferMin'
>;

export const DEFAULT_FILTERS: SearchFilters = {
  maxStops: DEFAULT_SEARCH_OPTIONS.maxStops,
  minConnectSameAirlineMin: DEFAULT_SEARCH_OPTIONS.minConnectSameAirlineMin,
  minConnectSwitchMin: DEFAULT_SEARCH_OPTIONS.minConnectSwitchMin,
  maxLayoverMin: DEFAULT_SEARCH_OPTIONS.maxLayoverMin,
  nearbyAirports: DEFAULT_SEARCH_OPTIONS.nearbyAirports,
  maxGroundTransferMin: DEFAULT_SEARCH_OPTIONS.maxGroundTransferMin,
};

function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
  format = formatDuration,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const c = useColors();
  const btn = (sign: 1 | -1) => {
    const next = value + sign * step;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={() => onChange(next)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${sign > 0 ? 'More' : 'Less'} ${label.toLowerCase()}`}
        accessibilityState={{ disabled }}
        style={[styles.stepBtn, { backgroundColor: c.surface2, opacity: disabled ? 0.4 : 1 }]}>
        <Text style={[textStyles.heading, { color: c.text }]}>{sign > 0 ? '+' : '−'}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.row} accessible={false}>
      <Text style={[textStyles.body, styles.label, { color: c.text }]}>{label}</Text>
      {btn(-1)}
      <Text style={[textStyles.bodyStrong, styles.value, { color: c.text }]} accessibilityLiveRegion="polite">
        {format(value)}
      </Text>
      {btn(1)}
    </View>
  );
}

export interface FiltersModalProps {
  visible: boolean;
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
}

export function FiltersModal({ visible, filters: f, onChange, onClose }: FiltersModalProps) {
  const c = useColors();
  const set = (patch: Partial<SearchFilters>) => onChange({ ...f, ...patch });
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
            Filters
          </Text>
          <Button label="Done" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
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
                  style={[styles.segment, { backgroundColor: on ? c.accent : c.surface2 }]}>
                  <Text style={[textStyles.bodyStrong, { color: on ? c.onAccent : c.text }]}>
                    {n === 0 ? 'Nonstop' : n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[textStyles.heading, { color: c.text }]}>Connections</Text>
          <Stepper label="Same airline, at least" value={f.minConnectSameAirlineMin} step={15} min={30} max={180}
            onChange={(v) => set({ minConnectSameAirlineMin: v })} />
          <Stepper label="Switching airlines, at least" value={f.minConnectSwitchMin} step={15} min={45} max={240}
            onChange={(v) => set({ minConnectSwitchMin: v })} />
          <Stepper label="Longest layover" value={f.maxLayoverMin} step={30} min={60} max={720}
            onChange={(v) => set({ maxLayoverMin: v })} />

          <Text style={[textStyles.heading, { color: c.text }]}>Nearby airports</Text>
          <View style={styles.row}>
            <Text style={[textStyles.body, styles.label, { color: c.text }]}>Include nearby airports</Text>
            <Switch
              value={f.nearbyAirports}
              onValueChange={(v) => set({ nearbyAirports: v })}
              accessibilityLabel="Include nearby airports"
              trackColor={{ true: c.accent, false: c.line2 }}
            />
          </View>
          {f.nearbyAirports ? (
            <Stepper label="Longest ground transfer" value={f.maxGroundTransferMin} step={15} min={15} max={120}
              onChange={(v) => set({ maxGroundTransferMin: v })} />
          ) : null}

          <Button label="Reset to Defaults" kind="secondary" onPress={() => onChange(DEFAULT_FILTERS)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.section,
  },
  body: { gap: spacing.section, paddingBottom: spacing.page },
  segments: { flexDirection: 'row', gap: spacing.group },
  segment: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget },
  label: { flex: 1 },
  value: { minWidth: 64, textAlign: 'center' },
  stepBtn: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
