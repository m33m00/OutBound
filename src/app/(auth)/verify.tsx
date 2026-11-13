import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { useAccount } from '@/account/AccountProvider';
import { AuthScreen, ErrorLine } from '@/account/AuthUI';
import type { CodePurpose } from '@/account/backend';
import { cleanCode, CODE_LENGTH, RESEND_AFTER_S } from '@/account/rules';
import { fonts, radius, spacing, textStyles, useColors, useColorSchemeName } from '@/theme';
import { Button, PillButton } from '@/ui/Buttons';
import { successTap } from '@/ui/haptics';

/**
 * Enter the 6-digit code we emailed (App Store round 2): confirms a new account's email, or
 * proves it's you before a new password. The code fills itself from Mail on iPhone.
 */
export default function VerifyScreen() {
  const c = useColors();
  const scheme = useColorSchemeName();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const purpose: CodePurpose = params.purpose === 'reset' ? 'reset' : 'signup';
  const account = useAccount();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [sent, setSent] = useState(false);
  const box = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const check = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    const r = await account.verifyCode(email, value, purpose);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setCode('');
      box.current?.focus();
      return;
    }
    successTap();
    // Sign up: you're in, and the app takes over. Reset: pick the new password next.
    if (purpose === 'reset') router.replace('/new-password');
  };

  const resend = async () => {
    setError(null);
    const r = await account.resendCode(email, purpose);
    if (!r.ok) return setError(r.error);
    setSent(true);
    setWait(RESEND_AFTER_S);
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');
  return (
    <AuthScreen
      title="Check Your Email"
      lead={`We sent a ${CODE_LENGTH}-digit code to ${email || 'your email'}. It can take a minute to arrive.`}>
      <Pressable onPress={() => box.current?.focus()} accessible={false}>
        <View style={styles.boxes} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {digits.map((d, i) => {
            const active = i === Math.min(code.length, CODE_LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.digit,
                  { backgroundColor: c.surface, borderColor: active ? c.accent : c.line2, borderWidth: active ? 2 : 1 },
                ]}>
                <Text style={[styles.digitText, { color: c.text }]}>{d}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={box}
          value={code}
          onChangeText={(t) => {
            const v = cleanCode(t);
            setCode(v);
            setError(null);
            if (v.length === CODE_LENGTH) check(v);
          }}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          keyboardAppearance={scheme}
          maxLength={CODE_LENGTH + 2}
          caretHidden
          accessibilityLabel={`${CODE_LENGTH}-digit code`}
          style={styles.hidden}
        />
      </Pressable>
      <ErrorLine text={error} />
      <Button label={busy ? 'Checking' : 'Continue'} onPress={() => check(code)} disabled={code.length !== CODE_LENGTH || busy} />
      <View style={styles.resend}>
        {wait > 0 ? (
          <Text style={[textStyles.small, { color: c.muted }]}>
            {sent ? 'Sent. ' : ''}You can ask for a new code in {wait}s.
          </Text>
        ) : (
          <PillButton label="Send a New Code" onPress={resend} />
        )}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  digit: { flex: 1, maxWidth: 52, aspectRatio: 0.82, borderRadius: radius.all, alignItems: 'center', justifyContent: 'center' },
  digitText: { fontFamily: fonts.mono, fontSize: 26 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  resend: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.group },
});
