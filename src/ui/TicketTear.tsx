import { StyleSheet, View } from 'react-native';

/** Half the height of the notch at each end of the tear. */
export const TEAR_NOTCH = 7;

/**
 * A subtle boarding pass perforation (round 121, John: "subtle boarding pass ticket" on the Clean
 * look): a fine dashed line with a small half-circle notch at each card edge, filled with the page
 * color behind the card so it reads as punched out. `left` and `right` pull the tear out to the
 * card's edges past the padding it sits in.
 */
export function TicketTear({
  notch,
  edge,
  line,
  left = 0,
  right = 0,
  edgeWidth = StyleSheet.hairlineWidth,
}: {
  /** The page color behind the card. */
  notch: string;
  /** The card's border color, drawn round each notch. */
  edge: string;
  /** The dashes. */
  line: string;
  left?: number;
  right?: number;
  /** The card's border width, so the notch sits on the card's outer edge and outlines to match. */
  edgeWidth?: number;
}) {
  const bite = {
    width: TEAR_NOTCH + edgeWidth,
    height: TEAR_NOTCH * 2,
    backgroundColor: notch,
    borderColor: edge,
    borderWidth: edgeWidth,
  };
  return (
    <View
      style={[styles.tear, { marginLeft: -(left + edgeWidth), marginRight: -(right + edgeWidth) }]}
      testID="ticket-tear"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <View style={[bite, styles.biteLeft]} />
      <View style={[styles.dash, { borderColor: line }]} />
      <View style={[bite, styles.biteRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tear: { flexDirection: 'row', alignItems: 'center', height: TEAR_NOTCH * 2 },
  dash: { flex: 1, borderTopWidth: 1, borderStyle: 'dashed', marginHorizontal: 8 },
  biteLeft: {
    borderTopRightRadius: TEAR_NOTCH,
    borderBottomRightRadius: TEAR_NOTCH,
    borderLeftWidth: 0,
  },
  biteRight: {
    borderTopLeftRadius: TEAR_NOTCH,
    borderBottomLeftRadius: TEAR_NOTCH,
    borderRightWidth: 0,
  },
});
