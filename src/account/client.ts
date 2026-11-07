import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { readLiveConfig } from '@/live/airportStatus';

/**
 * Which build this is. Store builds set EXPO_PUBLIC_APP_ENV=production (eas.json, production
 * profile); Expo Go previews don't. Read by name so Expo bakes it into the bundle.
 */
export const APP_ENV: string = process.env.EXPO_PUBLIC_APP_ENV ?? 'preview';

/**
 * Previews (Expo Go, TestFlight tests) can skip sign in to look around. A store build never can:
 * OutBound is only for airline employees.
 */
export const PREVIEW_ALLOWED = APP_ENV !== 'production';

let client: SupabaseClient | null | undefined;

/** The one Supabase client, or null when the app has no Supabase settings (local sample mode). */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readLiveConfig();
  if (!config) {
    client = null;
    return client;
  }
  client = createClient(config.baseUrl, config.anonKey, {
    auth: {
      // Sessions stay on this phone, so you stay signed in between launches.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      storageKey: 'outbound.auth.v1',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Keep the session fresh only while the app is open (Supabase's React Native advice).
  if (Platform.OS !== 'web') {
    const c = client;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') c.auth.startAutoRefresh();
      else c.auth.stopAutoRefresh();
    });
  }
  return client;
}

/** For tests: forget the client so the next call builds a new one. */
export function resetClientForTests(next?: SupabaseClient | null): void {
  client = next;
}
