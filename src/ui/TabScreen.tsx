import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, textStyles, useColors } from '@/theme';

/** A tab's page: title plus body. Feed and My Trips are placeholders until requests exist (Q-042). */
export function TabScreen({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[textStyles.title, { color: c.text }]} accessibilityRole="header">
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
