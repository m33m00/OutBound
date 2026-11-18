// Liquid Glass is a native iOS view (round 211). Tests draw the see-through fallback unless a test turns glass on
// with `require('expo-glass-effect').isLiquidGlassAvailable.mockReturnValue(true)`.
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return {
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
    GlassView: View,
    GlassContainer: View,
  };
});
