import { applyBoldText, boldTextOn, heavierFont } from '../boldText';
import { fonts } from '../fonts';
import { textStyles } from '../typography';

describe('Bold Text', () => {
  afterEach(() => applyBoldText(false));

  it('steps each face up a weight and stops at the heaviest', () => {
    expect(heavierFont('Manrope_400Regular')).toBe('Manrope_600SemiBold');
    expect(heavierFont('Manrope_500Medium')).toBe('Manrope_700Bold');
    expect(heavierFont('Manrope_700Bold')).toBe('Manrope_700Bold');
    expect(heavierFont('BigShouldersDisplay_700Bold')).toBe('BigShouldersDisplay_800ExtraBold');
  });

  it('turns every style heavier and back again', () => {
    applyBoldText(true);
    expect(boldTextOn()).toBe(true);
    expect(textStyles.body.fontFamily).toBe('Manrope_600SemiBold');
    expect(textStyles.small.fontFamily).toBe('Manrope_700Bold');
    expect(textStyles.title.fontFamily).toBe('BigShouldersDisplay_800ExtraBold');
    expect(fonts.bodyMedium).toBe('Manrope_700Bold');
    applyBoldText(false);
    expect(textStyles.body.fontFamily).toBe('Manrope_400Regular');
    expect(fonts.bodyMedium).toBe('Manrope_500Medium');
  });

  it('turning it on twice does not step up twice', () => {
    applyBoldText(true);
    applyBoldText(true);
    expect(textStyles.body.fontFamily).toBe('Manrope_600SemiBold');
  });
});
