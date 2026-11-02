import { StyleSheet, View } from 'react-native';

/** Half the height of the bite at each end of the tear. */
export const TEAR_NOTCH = 10;

/**
 * A boarding pass's torn edge (round 114): a dashed rule with a half-circle bite at each end, filled
 * with the page behind the card so it reads as cut out. Used on the route card and saved routes.
 */
export function TicketTear({ notch, line }: { notch: string; line: string }) {
  const bite = { width: TEAR_NOTCH, height: TEAR_NOTCH * 2, backgroundColor: notch, borderColor: line };
  return (
    <View style={styles.tear} testID="ticket-tear" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[bite, styles.biteLeft]} />
      <View style={[styles.tearLine, { borderColor: line }]} />
      <View style={[bite, styles.biteRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tear: { flexDirection: 'row', alignItems: 'center', height: TEAR_NOTCH * 2 },
  tearLine: { flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', marginHorizontal: 6 },
  biteLeft: {
    marginLeft: -StyleSheet.hairlineWidth,
    borderTopRightRadius: TEAR_NOTCH,
    borderBottomRightRadius: TEAR_NOTCH,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
  },
  biteRight: {
    marginRight: -StyleSheet.hairlineWidth,
    borderTopLeftRadius: TEAR_NOTCH,
    borderBottomLeftRadius: TEAR_NOTCH,
    borderWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
  },
});
