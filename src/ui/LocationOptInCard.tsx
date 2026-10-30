import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, textStyles, useColors } from '@/theme';

import { Button } from './Buttons';

export interface LocationOptInCardProps {
  /** Shows the iOS location prompt (only after this tap, Q-051). */
  onAllow: () => void;
  /** Never asked at launch again; can be turned on in Profile. */
  onNotNow: () => void;
}

/** First-launch card on the Search tab (Q-051): start From at the nearest airport? */
export function LocationOptInCard({ onAllow, onNotNow }: LocationOptInCardProps) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.accentSoft }]}>
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.heading, { color: c.text }]} accessibilityRole="header">
        Start searches from the airport nearest you?
      </Text>
      {/* Provisional body copy (not John-decided). */}
      <Text lineBreakStrategyIOS="push-out" style={[textStyles.small, { color: c.muted }]}>
        Uses your location only to pick the closest airport. Change it anytime in Profile.
      </Text>
      <View style={styles.buttons}>
        <Button label="Allow" onPress={onAllow} accessibilityLabel="Allow location access" style={styles.button} />
        {/* Outlined: the usual secondary fill (surface2) disappears on accentSoft. */}
        <Button
          label="Not Now"
          kind="secondary"
          onPress={onNotNow}
          accessibilityLabel="Not now"
          style={[styles.button, styles.outline, { backgroundColor: c.surface, borderColor: c.accent }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.group, padding: spacing.rowX, borderRadius: radius.md },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.group },
  button: { flexGrow: 1 },
  outline: { borderWidth: 1 },
});
