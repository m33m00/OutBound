import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { RadarButton } from '../RadarButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('RadarButton (design round 43)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));
  const sw = () => r!.root.find((n) => typeof n.type !== 'string' && n.props.accessibilityRole === 'switch');

  it('reads the radar age as its value, not a hint', () => {
    act(() => {
      r = create(<RadarButton on showing caption="Radar 4 min ago · NOAA/NWS" onToggle={jest.fn()} />);
    });
    expect(sw().props.accessibilityValue).toEqual({ text: 'Radar 4 min ago · NOAA/NWS' });
    expect(sw().props.accessibilityHint).toBeUndefined();
    expect(sw().props.accessibilityState).toEqual({ checked: true });
  });

  it('off: hint says what it does, no value', () => {
    act(() => {
      r = create(<RadarButton on={false} caption={null} onToggle={jest.fn()} />);
    });
    expect(sw().props.accessibilityValue).toBeUndefined();
    expect(sw().props.accessibilityHint).toBe('Shows rain on the globe');
  });
});
