import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AccountProvider, canUseApp, useAccount } from '@/account/AccountProvider';
import { markIntroDone } from '@/launch/introState';
import { LaunchIntro } from '@/launch/LaunchIntro';
import { MembershipProvider } from '@/membership/MembershipProvider';
import { ModerationProvider } from '@/moderation/ModerationProvider';
import { LogbookProvider } from '@/logbook/LogbookProvider';
import { RequestsProvider } from '@/requests/RequestsProvider';
import { readSavedAppearance, SettingsProvider } from '@/settings/SettingsProvider';
import { applyAppearance, applyBoldText, clearNativeAppearanceOverride, colors, fontAssets, useColorSchemeName } from '@/theme';
import { SavedRoutesProvider } from '@/trips/SavedRoutesProvider';
import { AirportSummaryProvider } from '@/ui/AirportSummary';
import { LocationProvider } from '@/ui/LocationProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorSchemeName();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Bold Text is read before the first screen draws, so nothing flips weight on screen.
  const [boldChecked, setBoldChecked] = useState(false);
  useEffect(() => {
    let live = true;
    // A change that arrives first wins over the launch read.
    let changed = false;
    const sub = AccessibilityInfo.addEventListener('boldTextChanged', (on: boolean) => {
      changed = true;
      applyBoldText(on);
    });
    // Wrapped so a platform without the check (web) still starts.
    Promise.resolve()
      .then(() => AccessibilityInfo.isBoldTextEnabled())
      .then((on) => {
        if (!changed) applyBoldText(on);
      })
      .catch(() => {})
      .finally(() => live && setBoldChecked(true));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  // Light, Dark or System is set before the first screen draws too (round 173), so the app the
  // launch intro lifts off is already in the right mode.
  const [appearanceChecked, setAppearanceChecked] = useState(false);
  useEffect(() => {
    let live = true;
    clearNativeAppearanceOverride();
    readSavedAppearance()
      .then(applyAppearance)
      .finally(() => live && setAppearanceChecked(true));
    return () => {
      live = false;
    };
  }, []);
  const ready = (fontsLoaded || fontError != null) && boldChecked && appearanceChecked;
  // The animated loading screen plays once per launch, over the app as it loads (App Store round 1).
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = colors[scheme];
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.line,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AccountProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={!introDone ? 'light' : scheme === 'dark' ? 'light' : 'dark'} />
          <AppStack />
          {introDone ? null : (
            <LaunchIntro
              onDone={() => {
                setIntroDone(true);
                markIntroDone();
              }}
            />
          )}
        </ThemeProvider>
      </AccountProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The app's screens, gated by account (App Store round 2): signed out you get the welcome and
 * account pages; signed in (or looking around in a preview build) you get the tabs. The privacy
 * policy and terms open either way. Deleting the account starts the phone's data over (epoch).
 */
function AppStack() {
  const account = useAccount();
  if (account.status === 'loading') return null;
  const inApp = canUseApp(account);
  return (
    <SettingsProvider key={account.epoch}>
      <SavedRoutesProvider>
        <LogbookProvider>
          <MembershipProvider>
            <RequestsProvider>
              <LocationProvider>
                <ModerationProvider>
                  <AirportSummaryProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Protected guard={inApp}>
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="account" />
                      </Stack.Protected>
                      <Stack.Protected guard={!inApp}>
                        <Stack.Screen name="(auth)" />
                      </Stack.Protected>
                      <Stack.Screen name="legal/[doc]" />
                    </Stack>
                  </AirportSummaryProvider>
                </ModerationProvider>
              </LocationProvider>
            </RequestsProvider>
          </MembershipProvider>
        </LogbookProvider>
      </SavedRoutesProvider>
    </SettingsProvider>
  );
}
