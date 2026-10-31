import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { resultsBanner } from '@/search/statusTags';
import { minTapTarget } from '@/theme';

import { ResultsBanner } from '../ResultsBanner';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ResultsBanner (Q-047)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  const buttons = () => r!.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress);

  it('hidden routes: Show Them and a 44pt Dismiss notice', () => {
    const onShow = jest.fn();
    const onDismiss = jest.fn();
    act(() => {
      r = create(<ResultsBanner banner={resultsBanner({ results: [], hiddenCount: 3 })!} onShow={onShow} onDismiss={onDismiss} />);
    });
    const [show, dismiss] = buttons();
    expect(show.props.accessibilityLabel).toBe('Show Them');
    expect(dismiss.props.accessibilityLabel).toBe('Dismiss notice');
    expect(StyleSheet.flatten(dismiss.props.style({ pressed: false }))).toMatchObject({ width: minTapTarget, height: minTapTarget });
    act(() => show.props.onPress());
    act(() => dismiss.props.onPress());
    expect(onShow).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('no flights: text and Dismiss only', () => {
    act(() => {
      r = create(<ResultsBanner banner={resultsBanner({ results: [], hiddenCount: 0 })!} onShow={jest.fn()} onDismiss={jest.fn()} />);
    });
    expect(buttons().map((b) => b.props.accessibilityLabel)).toEqual(['Dismiss notice']);
    const texts = r!.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
    expect(texts).toContain('No Flights Found on Selected Date');
  });

  it('no flights with a next day: Try Tomorrow searches it (Q-073)', () => {
    const onPress = jest.fn();
    act(() => {
      r = create(
        <ResultsBanner
          banner={resultsBanner({ results: [], hiddenCount: 0 })!}
          onShow={jest.fn()}
          onDismiss={jest.fn()}
          next={{ label: 'Try Tomorrow', hint: 'Searches Friday, October 31', onPress }}
        />,
      );
    });
    const [tryNext, dismiss] = buttons();
    expect(tryNext.props.accessibilityLabel).toBe('Try Tomorrow');
    expect(tryNext.props.accessibilityHint).toBe('Searches Friday, October 31');
    expect(StyleSheet.flatten(tryNext.props.style({ pressed: false }))).toMatchObject({ minHeight: minTapTarget });
    expect(dismiss.props.accessibilityLabel).toBe('Dismiss notice');
    act(() => tryNext.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });

  it('hidden routes never show the next-day button', () => {
    act(() => {
      r = create(
        <ResultsBanner
          banner={resultsBanner({ results: [], hiddenCount: 2 })!}
          onShow={jest.fn()}
          onDismiss={jest.fn()}
          next={{ label: 'Try Tomorrow', hint: 'Searches Friday, October 31', onPress: jest.fn() }}
        />,
      );
    });
    expect(buttons().map((b) => b.props.accessibilityLabel)).toEqual(['Show Them', 'Dismiss notice']);
  });
});
