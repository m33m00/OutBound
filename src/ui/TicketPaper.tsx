/**
 * The paper on a results ticket (round 221): a faint paper grain all over, with the stub under the perforation a
 * shade warmer (that tone lives in ResultRow).
 *
 * John picked the paper grain look ("Something to do with the destination and option 2"). Round 221 also pressed a
 * landmark sketch of each destination into the top right that drew itself in; round 222 took it off (John: "Get
 * rid of the backgrounds on the tickets I don't like it", "The landmark work"). Don't bring it back unasked.
 */
import { Image, StyleSheet } from 'react-native';

import type { ColorScheme } from '@/theme';

const GRAIN = {
  light: require('../../assets/images/grain-light.png'),
  dark: require('../../assets/images/grain-dark.png'),
} as const;

/** The paper grain over a whole ticket, repeating. */
export function TicketGrain({ scheme }: { scheme: ColorScheme }) {
  return (
    <Image source={GRAIN[scheme]} resizeMode="repeat" style={StyleSheet.absoluteFill} accessible={false} testID="ticket-grain" />
  );
}
