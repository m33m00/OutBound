import { BlurMask, Group, Path, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import { PULSE, pulseWindow } from './pulse';
import type { RoutePulse } from './routeLayer';

/**
 * The slow pulse that runs along each route line toward its destination (John, 2026-11-01).
 * Drawn on the canvas over the route picture; the caller leaves it out with Reduce Motion
 * and while the globe moves.
 */
export function RoutePulses({ pulses }: { pulses: readonly RoutePulse[] }) {
  const clock = useClock();
  return (
    <Group>
      {pulses.map((p) => (
        <LegPulse key={p.key} pulse={p} clock={clock} />
      ))}
    </Group>
  );
}

function LegPulse({ pulse, clock }: { pulse: RoutePulse; clock: ReturnType<typeof useClock> }) {
  const { legIndex, legCount } = pulse;
  const start = useDerivedValue(() => pulseWindow(clock.value, legIndex, legCount).start);
  const end = useDerivedValue(() => pulseWindow(clock.value, legIndex, legCount).end);
  return (
    <Path
      path={pulse.path}
      start={start}
      end={end}
      style="stroke"
      strokeWidth={pulse.width + 1}
      strokeCap="round"
      strokeJoin="round"
      color="#ffffff"
      opacity={pulse.selected ? PULSE.selectedAlpha : PULSE.otherAlpha}>
      <BlurMask blur={PULSE.blur} style="solid" />
    </Path>
  );
}
