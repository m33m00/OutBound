import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { planeCenterAt, planePolygon, polygonPath, trailPolygon } from './geometry';
import { BOX, LETTERS } from './jauntMark';

const TRAIL_PATH = polygonPath(trailPolygon(1));
const PLANE_PATH = polygonPath(planePolygon(planeCenterAt(1)));
const BOX_W = BOX.maxX - BOX.minX;
const BOX_H = BOX.maxY - BOX.minY;

/**
 * The Jaunt wordmark (John, 2026-11-14): lowercase "jaunt" in the text color, the t's contrail and
 * the plane in `accent`. `height` is the whole mark's height in points, the j's dot to its tail.
 */
export function JauntWordmark({ height, ink, accent, testID }: { height: number; ink: string; accent: string; testID?: string }) {
  const scale = height / BOX_H;
  const width = BOX_W * scale;
  return (
    <View testID={testID} accessible accessibilityRole="header" accessibilityLabel="Jaunt" style={{ width, height }}>
      {/* Keyed on its colors (round 213): a Skia canvas kept the colors it first drew with, so a switch to light
          mode left the letters in dark mode's near-white, nearly invisible on the light page. */}
      <Canvas key={`${ink}${accent}`} style={{ width, height }} pointerEvents="none">
        <Group transform={[{ translateX: -BOX.minX * scale }, { translateY: -BOX.minY * scale }, { scale }]}>
          {LETTERS.map((d, i) => (
            <Path key={i} path={d} color={ink} />
          ))}
          <Path path={TRAIL_PATH} color={accent} />
          <Path path={PLANE_PATH} color={accent} />
        </Group>
      </Canvas>
    </View>
  );
}

/** The wordmark's width for a given height, for layouts that need it up front. */
export const wordmarkWidth = (height: number) => (BOX_W / BOX_H) * height;
