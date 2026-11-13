import type { ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useChangePop } from './motion';

/** A view that settles in each time `on` changes (round 198); see useChangePop. */
export function Pop({
  on,
  style,
  children,
  testID,
}: {
  on: unknown;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
}) {
  const pop = useChangePop(on);
  return (
    <Animated.View style={[style, pop]} testID={testID}>
      {children}
    </Animated.View>
  );
}
