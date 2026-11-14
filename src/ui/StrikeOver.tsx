import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * How thick the line through a canceled flight's time is (round 203, John: "Canceled line crossing out the
 * time should be thicker"). Text's own strike-through is a hairline that can't be made thicker on iOS.
 */
export const STRIKE_W = 2.5;

/** A canceled time with a bold line drawn through it, as wide as the time itself. */
export function StrikeOver({
  color,
  children,
  style,
  testID,
}: {
  color: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {children}
      <View pointerEvents="none" style={[styles.bar, { backgroundColor: color }]} testID={testID ?? 'strike-bar'} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center', flexShrink: 1 },
  // Across the middle of the digits, a hair past each end so it reads as crossed out, not underlined.
  bar: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: '50%',
    marginTop: -STRIKE_W / 2 + 0.5,
    height: STRIKE_W,
    borderRadius: STRIKE_W / 2,
  },
});
