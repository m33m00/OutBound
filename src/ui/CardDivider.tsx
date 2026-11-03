import { StyleSheet, View } from 'react-native';

/**
 * A hairline between a card's header and its body (round 120, the Clean look; it replaced the
 * board's dashed rule and, before that, the boarding pass's torn edge). Used on saved routes.
 */
export function CardDivider({ line }: { line: string }) {
  return (
    <View
      style={[styles.rule, { backgroundColor: line }]}
      testID="card-divider"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
