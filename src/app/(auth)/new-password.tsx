import { useState } from 'react';

import { useAccount } from '@/account/AccountProvider';
import { AuthScreen, ErrorLine, Field } from '@/account/AuthUI';
import { checkPassword, MIN_PASSWORD } from '@/account/rules';
import { Button, PillButton } from '@/ui/Buttons';

/** Pick a new password after the reset code (App Store round 2). Saving it opens the app. */
export default function NewPasswordScreen() {
  const account = useAccount();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const pw = checkPassword(password);
    if (!pw.ok) return setError(pw.reason);
    setBusy(true);
    setError(null);
    const r = await account.setPassword(password);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <AuthScreen title="New Password" back={false}>
      <Field
        label="New password"
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
        returnKeyType="done"
        onSubmitEditing={submit}
        autoFocus
      />
      <ErrorLine text={error} />
      <Button label={busy ? 'Saving' : 'Save Password'} onPress={submit} disabled={busy || !password} haptic="success" />
      <PillButton label="Cancel" quiet onPress={() => account.logOut()} style={{ alignSelf: 'center' }} />
    </AuthScreen>
  );
}
