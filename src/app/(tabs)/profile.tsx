import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useSettings } from '@/settings/SettingsProvider';
import { profileSummary } from '@/settings/profileSummary';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { spacing, textStyles, useColors } from '@/theme';
import { ListGroup, ListRow } from '@/ui/ListGroup';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Profile tab. Shows what's set at a glance; every row opens Settings
 * (Q-024, Q-042). About holds the data credits (radar credit per DECISIONS.md).
 */
export default function ProfileScreen() {
  const c = useColors();
  const { settings } = useSettings();
  const openSettings = () => router.push('/settings');
  const version = Constants.expoConfig?.version;

  return (
    <TabScreen title="Profile">
      <ListGroup title="Your setup">
        {profileSummary(settings).map((row) => (
          <ListRow
            key={row.key}
            label={row.label}
            value={row.value}
            detail={row.detail}
            onPress={openSettings}
            accessibilityHint="Opens Settings"
          />
        ))}
      </ListGroup>

      <ListGroup title="About">
        <ListRow label="Flights" value={SCHEDULE_SOURCE === 'live' ? 'Daily schedules' : 'Sample data'} />
        <ListRow label="Airport delays" value="FAA" />
        <ListRow label="Weather" value="NOAA Aviation Weather" />
        <ListRow label="Radar" value="NOAA/NWS MRMS" />
        {version ? <ListRow label="Version" value={version} /> : null}
      </ListGroup>
      <Text style={[textStyles.small, styles.note, { color: c.muted }]}>
        Follow your airline’s rules on sharing loads.
      </Text>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: spacing.rowX },
});
