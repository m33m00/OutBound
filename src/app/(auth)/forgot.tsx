import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { AuthScreen, ErrorLine, Field } from '@/account/AuthUI';
import { looksLikeEmail, normalizeEmail } from '@/account/rules';
import { Button } from '@/ui/Buttons';

/** Forgot your password: we email a code, then you pick a new one (App Store round 2). */
export default function ForgotScreen() {
  const account = useAccount();
  const given = useLocalSearchParams<{ email?: string }>().email;
  const [email, setEmail] = useState(typeof given === 'string' ? given : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!looksLikeEmail(email)) return setError('Enter your work email.');
    setBusy(true);
    setError(null);
    const r = await account.sendReset(email);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push({ pathname: '/verify', params: { email: normalizeEmail(email), purpose: 'reset' } });
  };

  return (
    <AuthScreen title="Reset Password" lead="We’ll email you a code. Enter it next, then pick a new password.">
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
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus={!given}
      />
      <ErrorLine text={error} />
      <Button label={busy ? 'Sending Code' : 'Send Code'} onPress={submit} disabled={busy || !email.trim()} />
    </AuthScreen>
  );
}
