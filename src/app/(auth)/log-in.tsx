import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { AuthScreen, ErrorLine, Field } from '@/account/AuthUI';
import { looksLikeEmail, normalizeEmail } from '@/account/rules';
import { Button, PillButton } from '@/ui/Buttons';

/** Log in with your work email and password (App Store round 2). */
export default function LogInScreen() {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordBox = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (!looksLikeEmail(email)) return setError('Enter your work email.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    const r = await account.logIn(email, password);
    setBusy(false);
    if (r.ok) return;
    // Never confirmed the email: a fresh code went out, so go straight to entering it.
    if (r.needsCode) return router.push({ pathname: '/verify', params: { email: normalizeEmail(email), purpose: 'signup' } });
    setError(r.error);
  };

  return (
    <AuthScreen title="Log In">
      <Field
        label="Work email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        placeholder="name@airline.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordBox.current?.focus()}
        submitBehavior="submit"
      />
      <Field
        ref={passwordBox}
        label="Password"
        secret
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorLine text={error} />
      <Button label={busy ? 'Logging In' : 'Log In'} onPress={submit} disabled={busy || !email.trim() || !password} />
      <View style={styles.forgot}>
        <PillButton
          label="Forgot Password?"
          quiet
          onPress={() => router.push({ pathname: '/forgot', params: { email: normalizeEmail(email) } })}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ forgot: { alignItems: 'center' } });
