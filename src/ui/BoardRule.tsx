import { StyleSheet, View } from 'react-native';

/**
 * The dashed rule between a board panel's header and its rows (round 117, Departure board look; it
 * replaced round 114's torn ticket edge). Used on the route card and saved routes.
 */
export function BoardRule({ line }: { line: string }) {
  return (
    <View style={styles.rule} testID="board-rule" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.dash, { borderColor: line }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: 9, justifyContent: 'center' },
  dash: { borderTopWidth: 1, borderStyle: 'dashed' },
});
