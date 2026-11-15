import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors } from '@/theme';

import { Glass, GlassBackdrop } from '../Glass';

// Round 211 (John): "Less containers where you think it's necessary. More glassy look where containers exist".
const glass = require('expo-glass-effect') as { isLiquidGlassAvailable: jest.Mock };

describe('glass boxes (round 211)', () => {
  let r: ReactTestRenderer;
  const flat = (id: string) =>
    StyleSheet.flatten(r.root.find((n) => typeof n.type === 'string' && n.props.testID === id).props.style);

  afterEach(() => {
    glass.isLiquidGlassAvailable.mockReturnValue(false);
  });

  it("uses iOS's Liquid Glass where the phone has it, keeping the one corner radius", async () => {
    glass.isLiquidGlassAvailable.mockReturnValue(true);
    await act(async () => {
      r = create(
        <Glass testID="box">
          <Text>Hi</Text>
        </Glass>,
      );
    });
    const box = r.root.find((n) => typeof n.type === 'string' && n.props.testID === 'box');
    expect(box.props.glassEffectStyle).toBe('regular');
    expect(box.props.colorScheme).toBe('light');
    expect(flat('box').borderRadius).toBe(14);
  });

  it('is see-through white without Liquid Glass', async () => {
    await act(async () => {
      r = create(<Glass testID="box" />);
    });
    expect(flat('box').backgroundColor).toBe('rgba(255,255,255,0.78)');
  });

  it('turns solid with Reduce Transparency on', async () => {
    glass.isLiquidGlassAvailable.mockReturnValue(true);
    const spy = jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    await act(async () => {
      r = create(<Glass testID="box" />);
    });
    const box = r.root.find((n) => typeof n.type === 'string' && n.props.testID === 'box');
    expect(box.props.glassEffectStyle).toBeUndefined();
    expect(flat('box').backgroundColor).toBe(colors.light.surface);
    spy.mockRestore();
  });

  it('a bar behind its content is glass with Liquid Glass and solid without, so words over the map stay clear', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
    glass.isLiquidGlassAvailable.mockReturnValue(true);
    await act(async () => {
      r = create(<GlassBackdrop />);
    });
    expect(r.root.findAll((n) => n.props.testID === 'glass-backdrop' && typeof n.type === 'string')).toHaveLength(1);
    glass.isLiquidGlassAvailable.mockReturnValue(false);
    await act(async () => {
      r = create(<GlassBackdrop />);
    });
    expect(r.root.findAll((n) => n.props.testID === 'glass-backdrop')).toHaveLength(0);
  });
});
