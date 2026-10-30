import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RequestsProvider } from '@/requests/RequestsProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { applyBoldText, colors, fontAssets, useColorSchemeName } from '@/theme';
import { SavedRoutesProvider } from '@/trips/SavedRoutesProvider';
import { LocationProvider } from '@/ui/LocationProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorSchemeName();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Bold Text is read before the first screen draws, so nothing flips weight on screen.
  const [boldChecked, setBoldChecked] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isBoldTextEnabled()
      .then((on) => applyBoldText(on))
      .catch(() => {})
      .finally(() => live && setBoldChecked(true));
    const sub = AccessibilityInfo.addEventListener('boldTextChanged', applyBoldText);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const ready = (fontsLoaded || fontError != null) && boldChecked;

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
      <SettingsProvider>
        <SavedRoutesProvider>
          <RequestsProvider>
            <LocationProvider>
              <ThemeProvider value={navTheme}>
                <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
                <Stack screenOptions={{ headerShown: false }} />
              </ThemeProvider>
            </LocationProvider>
          </RequestsProvider>
        </SavedRoutesProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
