import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { applyBoldText, boldTextOn, heavierFont, useBoldText } from '../boldText';
import { fonts } from '../fonts';
import { textStyles } from '../typography';

describe('Bold Text', () => {
  afterEach(() => applyBoldText(false));

  it('steps each face up a weight and stops at the heaviest', () => {
    expect(heavierFont('DMSans_400Regular')).toBe('DMSans_600SemiBold');
    expect(heavierFont('DMSans_500Medium')).toBe('DMSans_700Bold');
    expect(heavierFont('DMSans_800ExtraBold')).toBe('DMSans_800ExtraBold');
    expect(heavierFont('DMMono_400Regular')).toBe('DMMono_500Medium');
    expect(heavierFont('InstrumentSerif_400Regular')).toBe('InstrumentSerif_400Regular');
    expect(heavierFont('BigShouldersDisplay_700Bold')).toBe('BigShouldersDisplay_800ExtraBold');
  });

  it('turns every style heavier and back again', () => {
    applyBoldText(true);
    expect(boldTextOn()).toBe(true);
    expect(textStyles.body.fontFamily).toBe('DMSans_600SemiBold');
    expect(textStyles.small.fontFamily).toBe('DMSans_700Bold');
    expect(textStyles.code.fontFamily).toBe('DMSans_800ExtraBold');
    expect(textStyles.title.fontFamily).toBe('InstrumentSerif_400Regular');
    expect(fonts.bodyMedium).toBe('DMSans_700Bold');
    applyBoldText(false);
    expect(textStyles.body.fontFamily).toBe('DMSans_400Regular');
    expect(fonts.bodyMedium).toBe('DMSans_500Medium');
  });

  it('turning it on twice does not step up twice', () => {
    applyBoldText(true);
    applyBoldText(true);
    expect(textStyles.body.fontFamily).toBe('DMSans_600SemiBold');
  });

  it('redraws parts that watch it when the setting changes', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    function Probe() {
      return <Text>{useBoldText() ? 'bold' : 'regular'}</Text>;
    }
    let r: ReturnType<typeof create> | undefined;
    act(() => {
      r = create(<Probe />);
    });
    expect(r!.root.findByType(Text).props.children).toBe('regular');
    act(() => applyBoldText(true));
    expect(r!.root.findByType(Text).props.children).toBe('bold');
    act(() => r!.unmount());
  });
});
