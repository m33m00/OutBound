import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlobeMap } from '@/map';
import { minTapTarget, radius, spacing, textStyles, useColors } from '@/theme';

/**
 * Placeholder home. DECISIONS.md: no tabs; top bar = wordmark, Requests pill,
 * Profile. Temporary globe preview fills the body until search (item 6).
 */
export default function HomeScreen() {
  const c = useColors();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.topBar}>
        <Text style={[textStyles.wordmark, { color: c.text }]} accessibilityRole="header">
          OutBound
        </Text>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Requests"
            style={[styles.pill, { backgroundColor: c.accentSoft }]}>
            <Text style={[textStyles.bodyStrong, { color: c.accent }]}>Requests</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            style={[styles.pill, { backgroundColor: c.surface2 }]}>
            <Text style={[textStyles.bodyStrong, { color: c.text }]}>Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <GlobeMap />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    minHeight: minTapTarget,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.group,
  },
  pill: {
    minHeight: minTapTarget,
    paddingHorizontal: spacing.rowX,
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
