import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import { applyBoldText, boldTextOn, heavierFont, useBoldText } from '../boldText';
import { fonts } from '../fonts';
import { textStyles } from '../typography';

describe('Bold Text', () => {
  afterEach(() => applyBoldText(false));

  it('steps each face up a weight and stops at the heaviest', () => {
    expect(heavierFont('Inter_400Regular')).toBe('Inter_600SemiBold');
    expect(heavierFont('Inter_500Medium')).toBe('Inter_700Bold');
    expect(heavierFont('Inter_800ExtraBold')).toBe('Inter_800ExtraBold');
    expect(heavierFont('BigShouldersDisplay_700Bold')).toBe('BigShouldersDisplay_800ExtraBold');
  });

  it('turns every style heavier and back again', () => {
    applyBoldText(true);
    expect(boldTextOn()).toBe(true);
    expect(textStyles.body.fontFamily).toBe('Inter_600SemiBold');
    expect(textStyles.small.fontFamily).toBe('Inter_700Bold');
    expect(textStyles.title.fontFamily).toBe('Inter_800ExtraBold');
    expect(fonts.bodyMedium).toBe('Inter_700Bold');
    applyBoldText(false);
    expect(textStyles.body.fontFamily).toBe('Inter_400Regular');
    expect(fonts.bodyMedium).toBe('Inter_500Medium');
  });

  it('turning it on twice does not step up twice', () => {
    applyBoldText(true);
    applyBoldText(true);
    expect(textStyles.body.fontFamily).toBe('Inter_600SemiBold');
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
