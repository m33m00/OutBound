import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Stepper } from '../Stepper';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

describe('Stepper big text (design round 46)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const render = () =>
    act(() => {
      r = create(<Stepper label="Be at the airport before departure" value={75} step={5} min={30} max={180} onChange={jest.fn()} />);
    });
  // Is the label in the same row as the − button, or on a line of its own?
  const labelBesideButtons = () => {
    const row = r!.root.find((n) => typeof n.type === 'string' && n.props.testID === 'stepper-row');
    return row.findAll((n) => typeof n.type === 'string' && n.props.children === 'Be at the airport before departure').length > 0;
  };

  it('keeps the label beside the buttons at normal sizes', () => {
    mockFontScale = 1;
    render();
    expect(labelBesideButtons()).toBe(true);
  });

  it('puts the label on its own line from 1.3x', () => {
    mockFontScale = 1.5;
    render();
    expect(labelBesideButtons()).toBe(false);
  });
});
