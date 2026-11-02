import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

/**
 * A header row whose title sits at the true center (John, 2026-11-01: the market wasn't
 * centered). The left and right controls are measured and both sides take the wider width,
 * so a wide control on one side doesn't push the title off center.
 */
export function CenteredTitleRow({
  left,
  title,
  right,
  style,
  onLayout,
  testID,
}: {
  left: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: { nativeEvent: { layout: { height: number } } }) => void;
  testID?: string;
}) {
  const [w, setW] = useState({ left: 0, right: 0 });
  const measure = (side: 'left' | 'right') => (e: { nativeEvent: { layout: { width: number } } }) => {
    const width = e.nativeEvent.layout.width;
    setW((prev) => (prev[side] === width ? prev : { ...prev, [side]: width }));
  };
  const side = { minWidth: Math.max(w.left, w.right) };
  return (
    <View style={[styles.row, style]} onLayout={onLayout} testID={testID}>
      <View style={[styles.side, side]} testID="title-side">
        <View onLayout={measure('left')}>{left}</View>
      </View>
      <View style={styles.title}>{title}</View>
      <View style={[styles.side, styles.end, side]} testID="title-side">
        <View onLayout={measure('right')}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.group },
  side: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  title: { flex: 1, alignItems: 'center' },
});
