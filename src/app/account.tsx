import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/account/AccountProvider';
import { ErrorLine } from '@/account/AuthUI';
import { confirmDeleteAccount } from '@/account/confirmDelete';
import { supportLink } from '@/legal/legal';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Buttons';
import { ListGroup, ListRow, SectionFooter } from '@/ui/ListGroup';
import { TITLE_MAX_SCALE } from '@/ui/SheetHeader';

/**
 * Account (App Store round 2): who's signed in, Log Out, and Delete Account, which Apple requires
 * in the app for any app that makes accounts (guideline 5.1.1(v)).
 */
export default function AccountScreen() {
  const c = useColors();
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = account.status === 'preview';

  const remove = async () => {
    if (!(await confirmDeleteAccount())) return;
    setBusy(true);
    setError(null);
    const r = await account.deleteAccount();
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton label="Back" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text
          lineBreakStrategyIOS="push-out"
          style={[textStyles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          Account
        </Text>

        {preview ? (
          <>
            <ListGroup>
              <ListRow label="Looking around" detail="This preview build lets you use OutBound without an account." />
            </ListGroup>
            <Button label="Create Account or Log In" onPress={() => account.logOut()} />
          </>
        ) : (
          <>
            <ListGroup>
              <ListRow label="Work email" value={account.user?.email ?? ''} />
            </ListGroup>
            <Button label="Log Out" kind="secondary" onPress={() => account.logOut()} />

            <View style={styles.danger}>
              <Pressable
                onPress={remove}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Delete Account"
                accessibilityHint="Deletes your account and everything you’ve shared, for good"
                style={({ pressed }) => [
                  styles.deleteRow,
                  { backgroundColor: pressed ? c.surface2 : c.surface, borderColor: c.line, opacity: busy ? 0.6 : 1 },
                ]}>
                {busy ? <ActivityIndicator color={c.canceled} /> : null}
                <Text style={[textStyles.button, { color: c.canceled }]}>{busy ? 'Deleting Account' : 'Delete Account'}</Text>
              </Pressable>
              <SectionFooter>Deletes your account and everything you’ve shared, right away. It can’t be undone.</SectionFooter>
              <ErrorLine text={error} />
            </View>
          </>
        )}

        <ListGroup title="Help">
          <ListRow label="Contact Support" onPress={() => Linking.openURL(supportLink())} />
        </ListGroup>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.page, paddingTop: spacing.group, minHeight: minTapTarget },
  body: { padding: spacing.page, gap: spacing.section, paddingBottom: spacing.page * 3 },
  danger: { gap: 6, marginTop: spacing.section },
  deleteRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.all,
    borderWidth: 1,
  },
});
