import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

/**
 * Pressed feedback (design round 2): everything tappable answers the finger
 * right away, like native iOS controls. No motion, so Reduce Motion is
 * unaffected. 'link' = text or icon on the page (dims more); 'fill' = a
 * filled button, chip or card (dims a little so its color stays readable).
 */
export const PRESSED_OPACITY = { link: 0.5, fill: 0.75 } as const;
export type PressKind = keyof typeof PRESSED_OPACITY;

export function pressStyle(style: StyleProp<ViewStyle>, kind: PressKind = 'fill') {
  return ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> =>
    pressed ? [style, { opacity: PRESSED_OPACITY[kind] }] : style;
}
