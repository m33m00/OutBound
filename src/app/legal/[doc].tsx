import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONTACT, LEGAL_UPDATED, legalPage, parseLegalDoc, supportLink } from '@/legal/legal';
import { minTapTarget, spacing, textStyles, useColors } from '@/theme';
import { BackButton } from '@/ui/BackButton';
import { PillButton } from '@/ui/Buttons';
import { TITLE_MAX_SCALE } from '@/ui/SheetHeader';

/** Privacy Policy or Terms of Use, readable signed in or out (App Store round 2). */
export default function LegalScreen() {
  const c = useColors();
  const doc = parseLegalDoc(useLocalSearchParams().doc) ?? 'privacy';
  const page = legalPage(doc);
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.title, { color: c.text }]} accessibilityRole="header" maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {page.title}
        </Text>
        <Text style={[textStyles.small, { color: c.muted }]}>Updated {LEGAL_UPDATED}</Text>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
          {page.intro}
        </Text>
        {page.sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
              {s.heading}
            </Text>
            {s.items.map((item) => (
              <Text key={item} lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
                {item}
              </Text>
            ))}
          </View>
        ))}
        <View style={styles.section}>
          <Text style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
            {CONTACT.heading}
          </Text>
          <Text lineBreakStrategyIOS="push-out" style={[textStyles.body, { color: c.text }]}>
            {CONTACT.text}
          </Text>
          <PillButton label="Get Help" trailing="arrow.up.right" onPress={() => Linking.openURL(supportLink())} style={styles.help} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.page, paddingTop: spacing.group, minHeight: minTapTarget },
  body: { padding: spacing.page, gap: spacing.section, paddingBottom: spacing.page * 3 },
  section: { gap: spacing.group, marginTop: spacing.group },
  help: { alignSelf: 'flex-start' },
});
