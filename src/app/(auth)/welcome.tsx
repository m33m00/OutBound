import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/account/AccountProvider';
import { InlineLink, openLegal } from '@/account/AuthUI';
import { spacing, textStyles, useColors, radius } from '@/theme';
import { Button, PillButton } from '@/ui/Buttons';

/**
 * First page for someone signed out (App Store round 2): the icon, the name, who it's for, and the
 * two ways in. The launch intro lifts away onto this page.
 */
export default function WelcomeScreen() {
  const c = useColors();
  const { canPreview, startPreview } = useAccount();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Image source={require('../../../assets/images/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text
          style={[textStyles.wordmark, styles.word, { color: c.text }]}
          accessibilityRole="header"
          accessibilityLabel="OutBound">
          OUTBOUND
        </Text>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, styles.tag, { color: c.muted }]}>
          Standby travel for airline employees
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create Account" onPress={() => router.push('/sign-up')} />
        <Button label="Log In" kind="secondary" onPress={() => router.push('/log-in')} />
        {canPreview ? (
          <PillButton
            label="Look Around First"
            quiet
            onPress={startPreview}
            accessibilityHint="Preview builds only. Opens the app without an account."
            style={styles.preview}
          />
        ) : null}
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, styles.legal, { color: c.muted }]}>
          Sign up with your airline work email. By continuing you agree to the{' '}
          <InlineLink label="Terms of Use" onPress={() => openLegal('terms')} /> and{' '}
          <InlineLink label="Privacy Policy" onPress={() => openLegal('privacy')} />.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.page * 1.5 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  icon: { width: 88, height: 88, borderRadius: radius.all },
  word: { fontSize: 30, lineHeight: 34, letterSpacing: 6, marginTop: 6 },
  tag: { textAlign: 'center' },
  actions: { gap: spacing.section, paddingBottom: spacing.page },
  preview: { alignSelf: 'center' },
  legal: { textAlign: 'center', marginTop: spacing.group },
});
