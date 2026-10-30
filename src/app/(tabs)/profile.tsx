import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';

import { useSettings } from '@/settings/SettingsProvider';
import { profileSummary, SETTINGS_SECTION_TITLE, settingsSectionFor } from '@/settings/profileSummary';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { spacing, textStyles, useColors } from '@/theme';
import { ListGroup, ListRow } from '@/ui/ListGroup';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Profile tab. Shows what's set at a glance; every row opens Settings at
 * its section (Q-024, Q-042, backlog 56). About holds the data credits (radar credit per DECISIONS.md).
 */
export default function ProfileScreen() {
  const c = useColors();
  const { settings } = useSettings();
  // Each row opens Settings at its own section (backlog 56).
  const openSettings = (key: Parameters<typeof settingsSectionFor>[0]) =>
    router.push({ pathname: '/settings', params: { section: settingsSectionFor(key) } });
  const version = Constants.expoConfig?.version;

  return (
    <TabScreen title="Profile">
      <ListGroup title="Your setup">
        {profileSummary(settings, Platform.OS === 'ios').map((row) => (
          <ListRow
            key={row.key}
            label={row.label}
            value={row.value}
            detail={row.detail}
            valueAccent={row.prompt}
            onPress={() => openSettings(row.key)}
            accessibilityHint={`Opens Settings at ${SETTINGS_SECTION_TITLE[settingsSectionFor(row.key)]}`}
          />
        ))}
      </ListGroup>

      <ListGroup title="About">
        {/* Credits name real sources only, so sample flights get no row (round 30). */}
        {SCHEDULE_SOURCE === 'live' ? <ListRow label="Flights" value="Daily schedules" /> : null}
        <ListRow label="Airport delays" value="FAA" />
        <ListRow label="Weather" value="NOAA Aviation Weather" />
        <ListRow label="Radar" value="NOAA/NWS MRMS" />
        {version ? <ListRow label="Version" value={version} /> : null}
      </ListGroup>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.note, { color: c.muted }]}>
        Follow your airline’s rules on sharing loads.
      </Text>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: spacing.rowX },
});
