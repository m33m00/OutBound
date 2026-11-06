import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInputInstance } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { AuthScreen, CheckRow, ErrorLine, Field, InlineLink, openLegal } from '@/account/AuthUI';
import { checkPassword, isPersonalEmail, looksLikeEmail, MIN_PASSWORD, NOT_AIRLINE_EMAIL, normalizeEmail } from '@/account/rules';
import { Button } from '@/ui/Buttons';

/** Create an account with an airline work email (App Store round 2). */
export default function SignUpScreen() {
  const account = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordBox = useRef<TextInputInstance>(null);

  const pw = checkPassword(password);
  const ready = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!looksLikeEmail(email)) return setError('Enter your work email.');
    if (isPersonalEmail(email)) return setError(NOT_AIRLINE_EMAIL);
    if (!pw.ok) return setError(pw.reason);
    if (!agreed) return setError('Agree to the Terms of Use to continue.');
    setBusy(true);
    setError(null);
    const r = await account.signUp(email, password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.needsCode) router.push({ pathname: '/verify', params: { email: normalizeEmail(email), purpose: 'signup' } });
  };

  return (
    <AuthScreen title="Create Account" lead="Use your airline work email. We’ll send a code to confirm it’s yours.">
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
        note={`At least ${MIN_PASSWORD} characters, with a letter and a number.`}
        secret
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules={`minlength: ${MIN_PASSWORD}; required: lower; required: digit;`}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <CheckRow checked={agreed} onToggle={() => setAgreed((a) => !a)} label="I agree to the Terms of Use and Privacy Policy">
        I agree to the <InlineLink label="Terms of Use" onPress={() => openLegal('terms')} /> and{' '}
        <InlineLink label="Privacy Policy" onPress={() => openLegal('privacy')} />, including no abusive or false reports.
      </CheckRow>
      <ErrorLine text={error} />
      <Button label={busy ? 'Creating Account' : 'Create Account'} onPress={submit} disabled={!ready} haptic="success" />
    </AuthScreen>
  );
}
