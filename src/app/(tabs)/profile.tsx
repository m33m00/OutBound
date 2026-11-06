import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { openLegal } from '@/account/AuthUI';
import { supportLink } from '@/legal/legal';

import { useSettings } from '@/settings/SettingsProvider';
import { profileSummary, SETTINGS_SECTION_TITLE, settingsSectionFor } from '@/settings/profileSummary';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { ListGroup, ListRow, SectionFooter } from '@/ui/ListGroup';
import { TabScreen } from '@/ui/TabScreen';

/**
 * Profile tab. Shows what's set at a glance; every row opens Settings at
 * its section (Q-024, Q-042, backlog 56). About holds the data credits (radar credit per DECISIONS.md).
 */
export default function ProfileScreen() {
  const { settings } = useSettings();
  const account = useAccount();
  // Each row opens Settings at its own section (backlog 56).
  const openSettings = (key: Parameters<typeof settingsSectionFor>[0]) =>
    router.push({ pathname: '/settings', params: { section: settingsSectionFor(key) } });
  const version = Constants.expoConfig?.version;

  return (
    <TabScreen title="Profile">
      <ListGroup title="Account">
        <ListRow
          label={account.status === 'preview' ? 'Not signed in' : 'Signed in'}
          value={account.status === 'preview' ? 'Preview' : account.user?.email}
          onPress={() => router.push('/account')}
          accessibilityHint="Opens Account: log out or delete your account"
        />
      </ListGroup>

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

      <ListGroup title="Legal and help">
        <ListRow label="Privacy Policy" onPress={() => openLegal('privacy')} />
        <ListRow label="Terms of Use" onPress={() => openLegal('terms')} />
        <ListRow label="Contact Support" onPress={() => Linking.openURL(supportLink())} />
      </ListGroup>
      {/* Apple 5.2: airline names and logos only identify flights; say plainly whose they are. */}
      <SectionFooter>OutBound is independent and isn’t affiliated with or endorsed by any airline. Airline names and logos belong to their owners.</SectionFooter>
    </TabScreen>
  );
}
