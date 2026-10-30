import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { minTapTarget } from '@/theme';

import { BackButton } from '../BackButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BackButton (design round 5)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('is a 44pt button with its own label and word', () => {
    const onPress = jest.fn();
    act(() => {
      r = create(<BackButton label="Search" accessibilityLabel="Back to search" onPress={onPress} />);
    });
    const btn = r!.root.find((n) => n.props.accessibilityRole === 'button' && typeof n.props.style === 'function');
    expect(btn.props.accessibilityLabel).toBe('Back to search');
    expect(StyleSheet.flatten(btn.props.style({ pressed: false })).minHeight).toBe(minTapTarget);
    const words = r!.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => n.props.children);
    expect(words).toContain('Search');
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });
});
