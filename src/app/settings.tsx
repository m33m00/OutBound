import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/settings/SettingsProvider';
import { AIRPORTS } from '@/engine';
import { confirmReset } from '@/settings/confirmReset';
import { parseSettingsSection, type SettingsSection } from '@/settings/profileSummary';
import { homeAirports, LIMITS } from '@/settings/settings';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { AirportPicker } from '@/ui/AirportPicker';
import { BackButton } from '@/ui/BackButton';
import { SectionFooter, SectionHeader } from '@/ui/ListGroup';
import { Button } from '@/ui/Buttons';
import { FiltersForm } from '@/ui/FiltersForm';
import { Stepper } from '@/ui/Stepper';
import { useSharedLocation } from '@/ui/LocationProvider';
import { useSheetContent } from '@/ui/useSheetContent';

/** Tester settings (backlog 12; Q-003, Q-024). Saved on this phone (Q-025). */
export default function SettingsScreen() {
  const c = useColors();
  const { settings, update, reset } = useSettings();
  const { status, request } = useSharedLocation();
  const [picking, setPicking] = useState<'main' | 'extra' | null>(null);
  const { homes } = settings;
  // The picker keeps its title while it slides away (design round 29).
  const pickerSheet = useSheetContent(picking);
  const homeList = homeAirports(homes);

  // Opened from a Profile row: scroll to that row's section once it's laid out (backlog 56).
  const target = parseSettingsSection(useLocalSearchParams().section);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(false);
  const sectionLayout = (section: SettingsSection) => (e: LayoutChangeEvent) => {
    if (section !== target || scrolled.current || section === 'homes') return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - spacing.page), animated: false });
  };

  const setUseLocation = async (on: boolean) => {
    if (!on) return update({ useLocation: false });
    // The iOS prompt only ever appears from a tap: this toggle, leave-by's button or the launch card's Allow.
    if (await request()) update({ useLocation: true });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton label="Back" onPress={() => router.back()} />
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
        <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
          Settings
        </Text>

        <View style={styles.section} onLayout={sectionLayout('homes')}>
          <SectionHeader title="Homes" />
          <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
            {homeList.length === 0 ? (
              <Text style={[textStyles.body, styles.empty, { color: c.muted }]}>No main home yet.</Text>
            ) : (
              homeList.map((h, i) => (
                <View
                  key={h.code}
                  style={[styles.row, i > 0 ? [styles.divided, { borderTopColor: c.line }] : null]}>
                  <Text style={[textStyles.number, styles.code, { color: c.text }]}>{h.code}</Text>
                  <View style={styles.label}>
                    <Text style={[textStyles.body, { color: c.text }]}>{AIRPORTS[h.code]?.name}</Text>
                    <Text style={[textStyles.small, { color: c.youText }]}>
                      {h.main ? 'Main home' : h.auto ? 'Same area, added automatically' : 'Also home'}
                    </Text>
                  </View>
                  {h.main ? (
                    <Button label="Change" kind="secondary" onPress={() => setPicking('main')} />
                  ) : h.auto ? null : (
                    <Button
                      label="Remove"
                      kind="secondary"
                      accessibilityLabel={`Remove ${h.code} from homes`}
                      onPress={() => update({ homes: { ...homes, extras: homes.extras.filter((x) => x !== h.code) } })}
                    />
                  )}
                </View>
              ))
            )}
            <View style={[styles.buttons, { borderTopColor: c.line }]}>
              {homes.main ? null : <Button label="Set Main Home" onPress={() => setPicking('main')} />}
              <Button label="Add Home" kind="secondary" icon="plus" onPress={() => setPicking('extra')} />
            </View>
          </View>
          <SectionFooter>
            Search starts from your main home when location is off, and Get Home takes you back to it.
          </SectionFooter>
        </View>

        <View style={styles.section} onLayout={sectionLayout('location')}>
          <SectionHeader title="Location" />
          <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
            <SwitchRow
              label="Use your location"
              hint="For the nearest airport and your drive estimate"
              value={settings.useLocation}
              onChange={setUseLocation}
            />
          </View>
          <SectionFooter>
            {status === 'denied'
              ? 'Location is off for OutBound. Turn it on in iPhone Settings, then try again.'
              : // Provisional copy (backlog 23): location now also picks From (Q-051).
                'Starts searches from the nearest airport and estimates your drive. Only used while the app is open.'}
          </SectionFooter>
        </View>

        <View style={styles.section} onLayout={sectionLayout('notify')}>
          <SectionHeader title="Notifications" />
          <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
            <SwitchRow
              label="Answers to your requests"
              caption="As soon as someone replies"
              value={settings.notify.answers}
              onChange={(on) => update({ notify: { ...settings.notify, answers: on } })}
            />
            <SwitchRow
              label="Requests on your airline’s flights"
              caption="At most 5 a day"
              value={settings.notify.airlineAsks}
              onChange={(on) => update({ notify: { ...settings.notify, airlineAsks: on } })}
              divided
            />
          </View>
          <SectionFooter>
            Other employees can ask about your airline’s flights, at most 5 requests a day. Nobody sees who asked or who
            answered.
          </SectionFooter>
        </View>

        <View style={styles.section} onLayout={sectionLayout('leaveBy')}>
          <SectionHeader title="Leave-by" />
          <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Stepper
              label="Be at the airport before departure"
              value={settings.bufferMin}
              {...LIMITS.bufferMin}
              format={(v) => `${v} min`}
              onChange={(v) => update({ bufferMin: v })}
            />
          </View>
          <SectionFooter>
            Time to list and clear security. The leave-by card counts back from your first departure.
          </SectionFooter>
        </View>

        <View style={styles.section} onLayout={sectionLayout('search')}>
          <SectionHeader title="Search defaults" />
          <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>
            <FiltersForm filters={settings.search} onChange={(search) => update({ search })} />
          </View>
          <SectionFooter>Every search starts with these. Change them for one search in Filters.</SectionFooter>
        </View>

        {/* Clears homes too, so it asks first (what it should clear is Q-064). */}
        <Button label="Reset All Settings" kind="secondary" onPress={() => confirmReset(reset)} />
        <Text style={[textStyles.small, { color: c.muted }]}>Saved on this phone.</Text>
      </ScrollView>
      <AirportPicker
        visible={pickerSheet.visible}
        title={pickerSheet.shown === 'main' ? 'Main home' : 'Add home'}
        current={pickerSheet.shown === 'main' ? homes.main : null}
        onPick={(code) => {
          if (picking === 'main') {
            update({ homes: { main: code, extras: homes.extras.filter((x) => x !== code) } });
          } else if (code !== homes.main && !homes.extras.includes(code)) {
            update({ homes: { ...homes, extras: [...homes.extras, code] } });
          }
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </SafeAreaView>
  );
}

/**
 * A setting with a switch: the whole row toggles it and VoiceOver reads it
 * as one switch (label, caption as the hint, on or off).
 */
function SwitchRow({
  label,
  caption,
  hint,
  value,
  onChange,
  divided,
}: {
  label: string;
  caption?: string;
  hint?: string;
  value: boolean;
  onChange: (on: boolean) => void;
  divided?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint ?? caption}
      style={[styles.row, divided && [styles.divided, { borderTopColor: c.line }]]}>
      <View style={styles.label}>
        <Text style={[textStyles.body, { color: c.text }]}>{label}</Text>
        {caption ? <Text style={[textStyles.small, { color: c.muted }]}>{caption}</Text> : null}
      </View>
      {/* The row takes the tap and speaks for it. */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch value={value} trackColor={{ true: c.accent, false: c.faint }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.page, minHeight: minTapTarget, justifyContent: 'center' },
  body: { paddingHorizontal: spacing.page, paddingBottom: spacing.page * 2, gap: spacing.section },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.rowX,
    gap: spacing.group,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group, minHeight: minTapTarget },
  label: { flex: 1 },
  code: { minWidth: 52 },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.group,
    paddingTop: spacing.group,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing.group },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.group },
  empty: { paddingVertical: spacing.group },
});
