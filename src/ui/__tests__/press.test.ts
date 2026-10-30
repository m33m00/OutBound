import { StyleSheet } from 'react-native';

import { PRESSED_OPACITY, pressStyle } from '../press';

describe('pressStyle', () => {
  const base = { minHeight: 44, opacity: 1 };

  it('leaves the style alone when not pressed', () => {
    expect(pressStyle(base)({ pressed: false })).toBe(base);
  });

  it('dims fills a little and links more while pressed', () => {
    const fill = StyleSheet.flatten(pressStyle(base)({ pressed: true }));
    const link = StyleSheet.flatten(pressStyle(base, 'link')({ pressed: true }));
    expect(fill).toMatchObject({ minHeight: 44, opacity: PRESSED_OPACITY.fill });
    expect(link?.opacity).toBe(PRESSED_OPACITY.link);
    expect(PRESSED_OPACITY.link).toBeLessThan(PRESSED_OPACITY.fill);
  });
});
