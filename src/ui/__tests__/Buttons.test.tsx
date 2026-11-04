import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { colors } from '@/theme';

import { Button, PillButton } from '../Buttons';

describe('one look per kind of button (round 139, John: boarding blue accent pass)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const look = (el: React.ReactElement) => {
    act(() => {
      r = create(el);
    });
    const box = r!.root.find(
      (n) => n.props.accessibilityRole === 'button' && typeof n.props.style !== 'function' && n.props.style,
    );
    const words = r!.root.findAllByType(Text).find((t) => typeof t.props.children === 'string')!;
    return { bg: StyleSheet.flatten(box.props.style).backgroundColor, fg: StyleSheet.flatten(words.props.style).color };
  };

  it('primary is filled boarding blue with white words', () => {
    expect(look(<Button label="Find Routes" onPress={jest.fn()} />)).toEqual({
      bg: colors.light.accent,
      fg: colors.light.onAccent,
    });
  });

  it('secondary buttons and soft pills share the accent tint with accent words', () => {
    const secondary = look(<Button label="Report" kind="secondary" onPress={jest.fn()} />);
    act(() => r?.unmount());
    const pill = look(<PillButton label="Back" onPress={jest.fn()} />);
    expect(secondary).toEqual({ bg: colors.light.accentSoft, fg: colors.light.accent });
    expect(pill).toEqual(secondary);
  });
});
