import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/settings/SettingsProvider';
import { LIMITS } from '@/settings/settings';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { Button } from '@/ui/Buttons';
import { FiltersForm } from '@/ui/FiltersForm';
import { Stepper } from '@/ui/Stepper';
import { useCurrentLocation } from '@/ui/useCurrentLocation';

/** Tester settings (backlog 12; Q-003, Q-024). Saved on this phone (Q-025). */
export default function SettingsScreen() {
  const c = useColors();
  const { settings, update, reset } = useSettings();
  const { status, request } = useCurrentLocation(false);

  const setUseLocation = async (on: boolean) => {
    if (!on) return update({ useLocation: false });
    // The iOS prompt only ever appears from this tap or the card's button.
    if (await request()) update({ useLocation: true });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}>
          <Text style={[textStyles.heading, { color: c.accent }]}>‹ Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
          Settings
        </Text>

        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[textStyles.heading, { color: c.text }]}>Leave-by</Text>
          <Stepper
            label="Be at the airport before departure"
            value={settings.bufferMin}
            {...LIMITS.bufferMin}
            format={(v) => `${v} min`}
            onChange={(v) => update({ bufferMin: v })}
          />
          <Text style={[textStyles.small, { color: c.muted }]}>
            Time to list and clear security. The leave-by card counts back from your first departure.
          </Text>
          <View style={styles.row}>
            <Text style={[textStyles.body, styles.label, { color: c.text }]}>Use my location</Text>
            <Switch
              value={settings.useLocation}
              onValueChange={setUseLocation}
              accessibilityLabel="Use my location for the drive estimate"
              trackColor={{ true: c.accent, false: c.line2 }}
            />
          </View>
          <Text style={[textStyles.small, { color: c.muted }]}>
            {status === 'denied'
              ? 'Location is off for OutBound. Turn it on in iPhone Settings, then try again.'
              : 'Estimates your drive to the airport. Only used while the app is open.'}
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[textStyles.heading, { color: c.text }]}>Search defaults</Text>
          <Text style={[textStyles.small, { color: c.muted }]}>
            Every search starts with these. Change them for one search in Filters.
          </Text>
          <FiltersForm filters={settings.search} onChange={(search) => update({ search })} />
        </View>

        <Button label="Reset to Defaults" kind="secondary" onPress={reset} />
        <Text style={[textStyles.small, { color: c.muted }]}>Saved on this phone.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.page, minHeight: minTapTarget, justifyContent: 'center' },
  back: { minHeight: minTapTarget, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: spacing.page },
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2, gap: spacing.section },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.rowX,
    gap: spacing.group,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget },
  label: { flex: 1 },
});
