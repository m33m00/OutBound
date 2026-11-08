import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { openLegal } from '@/account/AuthUI';
import { supportLink } from '@/legal/legal';
import { SCHEDULE_SOURCE } from '@/search/useRouteSearch';
import { confirmReset } from '@/settings/confirmReset';
import { profileSummary, SETTINGS_SECTION_TITLE, settingsSectionFor, type SummaryRow } from '@/settings/profileSummary';
import { changedFilters, DEFAULT_FILTERS } from '@/settings/settings';
import { useSettings } from '@/settings/SettingsProvider';
import { spacing, textStyles, useColors } from '@/theme';
import { logosOn } from '@/ui/AirlinePill';
import { Button } from '@/ui/Buttons';
import { ListGroup, ListRow, SectionFooter } from '@/ui/ListGroup';
import { useSharedLocation } from '@/ui/LocationProvider';
import { pressStyle } from '@/ui/press';
import { AppearanceChoice, ListControlRow, ListSwitchRow, Segments } from '@/ui/SettingsControls';
import { TabScreen } from '@/ui/TabScreen';
import { CreditsSheet } from '@/ui/Credits';
import { creditsWord, TIER_LABEL, TIERS } from '@/membership/membership';
import { useMembershipOptional } from '@/membership/MembershipProvider';

/**
 * The Settings tab (round 174, John: "Profile tab should be renamed to Settings and Cog icon. Inside
 * settings it should be grouped differently. Organize it logically"). The route keeps its old name,
 * profile, so nothing that links here breaks. Simple on/off and pick-one settings change right here;
 * anything with more to it opens its own page. Groups run from you, to your trips, to the app, to help.
 */
const ROW_ICON: Record<SummaryRow['key'], SFSymbol> = {
  home: 'house.fill',
  otherHomes: 'house',
  location: 'location.fill',
  appearance: 'circle.lefthalf.filled',
  notify: 'bell.fill',
  buffer: 'clock',
  maps: 'map',
  search: 'line.3.horizontal.decrease.circle',
};

export default function SettingsTab() {
  const c = useColors();
  const { settings, update, reset } = useSettings();
  const account = useAccount();
  const { status, request } = useSharedLocation();
  const rows = profileSummary(settings, Platform.OS === 'ios');
  const summary = (key: SummaryRow['key']) => rows.find((r) => r.key === key);
  const version = Constants.expoConfig?.version;
  const membership = useMembershipOptional();
  const [creditsOpen, setCreditsOpen] = useState(false);

  const open = (key: SummaryRow['key']) => router.push({ pathname: '/settings', params: { section: settingsSectionFor(key) } });
  const row = (key: SummaryRow['key']) => {
    const r = summary(key);
    if (!r) return null;
    return (
      <ListRow
        key={key}
        label={r.label}
        value={r.value}
        detail={r.detail}
        valueAccent={r.prompt}
        icon={ROW_ICON[key]}
        onPress={() => open(key)}
        accessibilityHint={`Opens ${SETTINGS_SECTION_TITLE[settingsSectionFor(key)]}`}
      />
    );
  };
  // Search defaults: stops on the row, the count of other filters set under it.
  const moreFilters = changedFilters({ ...settings.search, maxStops: DEFAULT_FILTERS.maxStops });
  const searchRow = summary('search');

  const setUseLocation = async (on: boolean) => {
    if (!on) return update({ useLocation: false });
    // The iOS prompt only ever appears from a tap: this switch, leave-by's button or the launch card's Allow.
    if (await request()) update({ useLocation: true });
  };

  return (
    <TabScreen title="Settings">
      <ListGroup title="Account">
        <ListRow
          icon="person.crop.circle.fill"
          label={account.status === 'preview' ? 'Not signed in' : 'Signed in'}
          value={account.status === 'preview' ? 'Preview' : account.user?.email}
          onPress={() => router.push('/account')}
          accessibilityHint="Opens Account: log out or delete your account"
        />
      </ListGroup>

      {/* The plan picked on the Search tab, changeable here while it's a demo (round 176, John). */}
      {membership ? (
        <>
          <ListGroup title="Membership">
            <ListControlRow label="Plan" icon="star.fill">
              <Segments
                label="Plan"
                testID="plan-choice"
                options={TIERS}
                value={membership.tier ?? ('' as (typeof TIERS)[number])}
                name={(t) => TIER_LABEL[t]}
                onChange={membership.setTier}
              />
            </ListControlRow>
            {membership.tracksCredits ? (
              <ListRow
                icon="ticket.fill"
                label="Credits"
                value={creditsWord(membership.credits)}
                onPress={() => setCreditsOpen(true)}
                accessibilityHint="Opens your credits"
              />
            ) : null}
          </ListGroup>
          <SectionFooter>
            {membership.tier === 'premium'
              ? 'Every load shows, with no credits to track.'
              : membership.tier
                ? 'Seats stay hidden until you request a route’s loads. Answering loads earns credits.'
                : 'Pick a plan to choose how you see loads.'}{' '}
            A demo for now, so nothing is charged.
          </SectionFooter>
          {membership.tier ? (
            <CreditsSheet
              visible={creditsOpen}
              tier={membership.tier}
              wallet={membership.wallet}
              onClose={() => setCreditsOpen(false)}
              onAnswerLoads={() => {
                setCreditsOpen(false);
                router.navigate('/feed');
              }}
            />
          ) : null}
        </>
      ) : null}

      <ListGroup title="Home airports">
        {row('home')}
        {row('otherHomes')}
      </ListGroup>

      <ListGroup title="Getting to the airport">
        {row('buffer')}
        {row('maps')}
        <ListSwitchRow
          testID="settings-location"
          icon="location.fill"
          label="Use your location"
          detail="Nearest airport and drive time"
          value={settings.useLocation}
          onChange={setUseLocation}
        />
      </ListGroup>
      <SectionFooter>
        {status === 'denied'
          ? 'Location is off for OutBound. Turn it on in iPhone Settings, then try again.'
          : 'Location is only used while the app is open.'}
      </SectionFooter>

      <ListGroup title="Search">
        {searchRow ? (
          <ListRow
            label={searchRow.label}
            value={searchRow.value}
            detail={
              moreFilters
                ? `${moreFilters} more ${moreFilters === 1 ? 'filter' : 'filters'} set`
                : 'Departure time, airlines, loads and airports'
            }
            icon={ROW_ICON.search}
            onPress={() => open('search')}
            accessibilityHint="Opens Search defaults"
          />
        ) : null}
      </ListGroup>

      <ListGroup title="Display">
        <ListControlRow label="Appearance" icon="circle.lefthalf.filled">
          <AppearanceChoice value={settings.appearance} onChange={(appearance) => update({ appearance })} />
        </ListControlRow>
        <ListSwitchRow
          testID="settings-radar"
          icon="cloud.rain"
          label="Rain radar"
          detail="Live rain on the globe, from NOAA"
          value={settings.radarOn}
          onChange={(radarOn) => update({ radarOn })}
        />
        <ListSwitchRow
          testID="settings-sounds"
          icon="speaker.wave.2.fill"
          label="Sound effects"
          detail="A yaoom when your request is answered"
          value={settings.sounds}
          onChange={(sounds) => update({ sounds })}
        />
      </ListGroup>

      <ListGroup title="Notifications">{row('notify')}</ListGroup>

      <ListGroup title="Help and legal">
        <ListRow icon="envelope" label="Contact Support" onPress={() => Linking.openURL(supportLink())} />
        <ListRow icon="hand.raised" label="Privacy Policy" onPress={() => openLegal('privacy')} />
        <ListRow icon="doc.text" label="Terms of Use" onPress={() => openLegal('terms')} />
      </ListGroup>

      <ListGroup title="About">
        {/* Credits name real sources only, so sample flights get no row (round 30). */}
        {SCHEDULE_SOURCE === 'live' ? <ListRow icon="airplane" label="Flights" value="Daily schedules" /> : null}
        <ListRow icon="exclamationmark.triangle" label="Airport delays" value="FAA" />
        <ListRow icon="cloud.sun" label="Weather" value="NOAA Aviation Weather" />
        <ListRow icon="antenna.radiowaves.left.and.right" label="Radar" value="NOAA/NWS MRMS" />
        {version ? <ListRow icon="info.circle" label="Version" value={version} /> : null}
      </ListGroup>
      {/* Logo.dev's free plan asks for a visible link wherever its logos show (round 133). */}
      {logosOn() ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Airline logos provided by Logo.dev"
          onPress={() => Linking.openURL('https://logo.dev')}
          style={pressStyle(styles.credit, 'link')}
          testID="logo-credit">
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
            Airline logos provided by <Text style={{ color: c.accent }}>Logo.dev</Text>. Each logo belongs to its airline.
          </Text>
        </Pressable>
      ) : null}
      {/* Apple 5.2: airline names and logos only identify flights; say plainly whose they are. */}
      <SectionFooter>
        OutBound is independent and isn’t affiliated with or endorsed by any airline. Airline names and logos belong to their
        owners.
      </SectionFooter>

      {/* Clears homes too, so it asks first (what it should clear is Q-064). */}
      <Button label="Reset All Settings" kind="secondary" onPress={() => confirmReset(reset)} />
      <SectionFooter>Settings are saved on this phone.</SectionFooter>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  credit: { paddingHorizontal: spacing.rowX },
});
