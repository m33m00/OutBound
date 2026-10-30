import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors, fonts } from '@/theme';

import { SheetHeader } from '../SheetHeader';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SheetHeader', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const actionText = () =>
    StyleSheet.flatten(
      r!.root.findAll((n) => n.props.testID === 'sheet-action' && typeof n.type === 'string')[0].findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')[0].props.style,
    );

  it('shows the title and a bold blue Done text button', () => {
    const onAction = jest.fn();
    act(() => {
      r = create(<SheetHeader title="Filters" action="Done" onAction={onAction} />);
    });
    const header = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && typeof n.type === 'string')[0];
    expect(header.props.children).toBe('Filters');
    expect(actionText().color).toBe(colors.light.accent);
    expect(actionText().fontFamily).toBe(fonts.bodyBold);
    const done = r!.root.findAll((n) => n.props.accessibilityLabel === 'Done' && n.props.onPress)[0];
    act(() => done.props.onPress());
    expect(onAction).toHaveBeenCalled();
  });

  it('sets Cancel in regular weight, like iOS', () => {
    act(() => {
      r = create(<SheetHeader title="From" action="Cancel" onAction={jest.fn()} />);
    });
    expect(actionText().fontFamily).toBe(fonts.bodyMedium);
  });
});
