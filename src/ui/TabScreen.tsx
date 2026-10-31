import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, textStyles, useColors } from '@/theme';

import { TITLE_MAX_SCALE } from './SheetHeader';

/** A tab's page: title plus a scrolling body. */
export function TabScreen({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text lineBreakStrategyIOS="push-out" style={[textStyles.title, { color: c.text }]} accessibilityRole="header" maxFontSizeMultiplier={TITLE_MAX_SCALE}>
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: spacing.page, gap: spacing.section },
});
