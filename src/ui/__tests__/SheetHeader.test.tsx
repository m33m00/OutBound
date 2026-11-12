import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors, fonts } from '@/theme';

import { SheetHeader } from '../SheetHeader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

describe('SheetHeader', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    mockFontScale = 1;
  });

  it('caps the title size and puts Done on its own line at the biggest text', () => {
    mockFontScale = 2.5;
    act(() => {
      r = create(<SheetHeader title="Departures from DAL" action="Done" onAction={() => {}} />);
    });
    const header = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && typeof n.type === 'string')[0];
    expect(header.props.maxFontSizeMultiplier).toBe(1.6);
    const row = r!.root.findAll(
      (n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.paddingVertical != null,
    )[0];
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column-reverse');
  });

  const actionText = () =>
    StyleSheet.flatten(
      r!.root
        .findAll((n) => n.props.testID === 'sheet-action' && typeof n.type === 'string')[0]
        .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0].props.style,
    );

  it('shows the title and a filled blue Done button (round 79)', () => {
    const onAction = jest.fn();
    act(() => {
      r = create(<SheetHeader title="Filters" action="Done" onAction={onAction} />);
    });
    const header = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && typeof n.type === 'string')[0];
    expect(header.props.children).toBe('Filters');
    expect(actionText().color).toBe(colors.light.onAccent);
    const pill = r!.root.findAll((n) => n.props.testID === 'sheet-action' && typeof n.type === 'string')[0];
    expect(StyleSheet.flatten(pill.props.style).backgroundColor).toBe(colors.light.accent);
    const done = r!.root.findAll((n) => n.props.accessibilityLabel === 'Done' && n.props.onPress)[0];
    act(() => done.props.onPress());
    expect(onAction).toHaveBeenCalled();
  });

  it('sets Cancel as a soft button in regular weight, like iOS', () => {
    act(() => {
      r = create(<SheetHeader title="From" action="Cancel" onAction={jest.fn()} />);
    });
    expect(actionText().fontFamily).toBe(fonts.bodyMedium);
    expect(actionText().color).toBe(colors.light.accent);
    const pill = r!.root.findAll((n) => n.props.testID === 'sheet-action' && typeof n.type === 'string')[0];
    expect(StyleSheet.flatten(pill.props.style).backgroundColor).toBe(colors.light.accentSoft);
  });
});
