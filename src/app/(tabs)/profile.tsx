import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import type { SFSymbol } from 'expo-symbols';

import { useSettings } from '@/settings/SettingsProvider';
import { profileSummary, SETTINGS_SECTION_TITLE, settingsSectionFor } from '@/settings/profileSummary';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { ListGroup, ListRow } from '@/ui/ListGroup';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Profile tab. Shows what's set at a glance; every row opens Settings at
 * its section (Q-024, Q-042, backlog 56). About holds the data credits (radar credit per DECISIONS.md).
 */
/** Each setup row's icon tile (round 166). */
const ROW_ICON: Record<ReturnType<typeof profileSummary>[number]['key'], SFSymbol> = {
  home: 'house.fill',
  otherHomes: 'house',
  location: 'location.fill',
  notify: 'bell.fill',
  buffer: 'clock',
  maps: 'map',
  search: 'line.3.horizontal.decrease.circle',
};

export default function ProfileScreen() {
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
            icon={ROW_ICON[row.key]}
            onPress={() => openSettings(row.key)}
            accessibilityHint={`Opens Settings at ${SETTINGS_SECTION_TITLE[settingsSectionFor(row.key)]}`}
          />
        ))}
      </ListGroup>

      <ListGroup title="About">
        {/* Credits name real sources only, so sample flights get no row (round 30). */}
        {SCHEDULE_SOURCE === 'live' ? <ListRow icon="airplane" label="Flights" value="Daily schedules" /> : null}
        <ListRow icon="exclamationmark.triangle" label="Airport delays" value="FAA" />
        <ListRow icon="cloud.rain" label="Weather" value="NOAA Aviation Weather" />
        <ListRow icon="antenna.radiowaves.left.and.right" label="Radar" value="NOAA/NWS MRMS" />
        {version ? <ListRow icon="info.circle" label="Version" value={version} /> : null}
      </ListGroup>
    </TabScreen>
  );
}
