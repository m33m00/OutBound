import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { minTapTarget } from '@/theme';

import { EmptyState } from '../EmptyState';
import { ListGroup, ListRow } from '../ListGroup';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

describe('ListGroup and ListRow', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    mockFontScale = 1;
  });

  it('puts the value under the label at big text, uncut', () => {
    mockFontScale = 2;
    act(() => {
      r = create(<ListRow label="Notifications" value="Airline requests only" onPress={() => {}} />);
    });
    const value = r!.root.findAll((n) => typeof n.type === 'string' && n.props.children === 'Airline requests only')[0];
    expect(value.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(value.props.style).maxWidth).toBeUndefined();
  });

  it('tappable rows are 44pt buttons labeled with label, value and detail', () => {
    const onPress = jest.fn();
    act(() => {
      r = create(
        <ListGroup title="Your setup">
          <ListRow label="Main home" value="DAL" detail="Dallas Love Field" onPress={onPress} />
          <ListRow label="Version" value="1.0.0" />
        </ListGroup>,
      );
    });
    const buttons = r!.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.accessibilityLabel).toBe('Main home, DAL, Dallas Love Field');
    const style = StyleSheet.flatten(buttons[0].props.style({ pressed: false }));
    expect(style.minHeight).toBeGreaterThanOrEqual(minTapTarget);
    act(() => buttons[0].props.onPress());
    expect(onPress).toHaveBeenCalled();
    // Static row reads as one element, no button role.
    const info = r!.root.findAll((n) => n.props.accessible && n.props.accessibilityLabel === 'Version, 1.0.0');
    expect(info.length).toBeGreaterThan(0);
  });

  it('puts one separator between rows and a header above', () => {
    act(() => {
      r = create(
        <ListGroup title="About">
          <ListRow label="A" />
          <ListRow label="B" />
          <ListRow label="C" />
          {null}
        </ListGroup>,
      );
    });
    const header = r!.root.findAll((n) => n.props.accessibilityRole === 'header' && (n.type as unknown) === 'Text');
    expect(header[0].props.children).toBe('ABOUT');
    const seps = r!.root.findAll(
      (n) =>
        (n.type as unknown) === 'View' &&
        StyleSheet.flatten(n.props.style)?.height === StyleSheet.hairlineWidth,
    );
    expect(seps).toHaveLength(2);
  });
});

describe('EmptyState', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('reads as one element with title, body and points', () => {
    act(() => {
      r = create(<EmptyState icon="suitcase" title="No trips yet" body="Saved here." points={['One', 'Two']} />);
    });
    const el = r!.root.findAll((n) => n.props.accessible && typeof n.props.accessibilityLabel === 'string');
    expect(el[0].props.accessibilityLabel).toBe('No trips yet. Saved here. One. Two');
  });
});
