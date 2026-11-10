import { Stack } from 'expo-router';

/** Account pages before you're in: welcome, create account, log in, codes, new password. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

/** Signed out, the account pages open on the welcome page. */
export const unstable_settings = { initialRouteName: 'welcome' };
