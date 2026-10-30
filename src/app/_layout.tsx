import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SettingsProvider } from '@/settings/SettingsProvider';
import { colors, fontAssets, useColorSchemeName } from '@/theme';
import { SavedRoutesProvider } from '@/trips/SavedRoutesProvider';
import { LocationProvider } from '@/ui/LocationProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorSchemeName();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError != null;

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
          <LocationProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false }} />
            </ThemeProvider>
          </LocationProvider>
        </SavedRoutesProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
