import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Text } from 'react-native';

import { STAGGER, StaggerIn } from '../StaggerIn';

jest.mock('../useReducedMotion', () => ({ useReducedMotion: jest.fn(() => false) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useReducedMotion } = require('../useReducedMotion') as { useReducedMotion: jest.Mock };

const opacityOf = (r: ReactTestRenderer) => {
  const style = r.root.findByProps({ testID: 'stagger-in' }).props.style;
  const o = (Array.isArray(style) ? Object.assign({}, ...style) : style).opacity;
  return typeof o === 'number' ? o : o.__getValue();
};

describe('StaggerIn (round 113)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useReducedMotion.mockReturnValue(false);
  });

  it('fades each row in a beat after the one above, capped so long lists never wait', () => {
    const timing = jest.spyOn(Animated, 'timing');
    let r: ReactTestRenderer;
    act(() => {
      r = create(
        <>
          <StaggerIn step={2} play>
            <Text>Row</Text>
          </StaggerIn>
          <StaggerIn step={40} play>
            <Text>Far row</Text>
          </StaggerIn>
        </>,
      );
    });
    expect(timing.mock.calls[0][1]).toMatchObject({
      toValue: 1,
      duration: STAGGER.ms,
      delay: 2 * STAGGER.stepMs,
      useNativeDriver: true,
    });
    expect(timing.mock.calls[1][1]).toMatchObject({ delay: STAGGER.maxSteps * STAGGER.stepMs });
    expect(STAGGER.ms + STAGGER.maxSteps * STAGGER.stepMs).toBeLessThanOrEqual(600);
    r!.unmount();
  });

  it('just shows the row when not playing, or with Reduce Motion', () => {
    const timing = jest.spyOn(Animated, 'timing');
    let r: ReactTestRenderer;
    act(() => {
      r = create(
        <StaggerIn step={1} play={false}>
          <Text>Row</Text>
        </StaggerIn>,
      );
    });
    expect(opacityOf(r!)).toBe(1);
    useReducedMotion.mockReturnValue(true);
    act(() => {
      r!.update(
        <StaggerIn step={1} play key="again">
          <Text>Row</Text>
        </StaggerIn>,
      );
    });
    expect(opacityOf(r!)).toBe(1);
    expect(timing).not.toHaveBeenCalled();
    r!.unmount();
  });
});
