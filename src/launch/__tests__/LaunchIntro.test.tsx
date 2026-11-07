/**
 * Round 169: the lift into the app looked choppy because every frame of it was a JS re-render
 * while the app mounted underneath. The take-off now freezes the drawing and runs the plane's
 * flight and the panel's lift as native-driver Animated timings. These tests keep it that way.
 */
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native');
  const Box = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Canvas: View,
    Group: Box,
    Path: () => null,
    Circle: () => null,
    Skia: {
      Path: { MakeFromSVGString: () => ({ kind: 'path' }), Polygon: () => ({ kind: 'polygon' }) },
      Point: (x: number, y: number) => ({ x, y }),
    },
  };
});

let mockReduce = false;
jest.mock('@/ui/useReducedMotion', () => ({ useReducedMotion: () => mockReduce }));

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated } from 'react-native';

import { LaunchIntro } from '../LaunchIntro';
import { exitPlan, INTRO_MS, introFrame, introLayout, REDUCED_INTRO_MS, TIMING } from '../introMotion';

declare const require: (m: string) => unknown;
declare const __dirname: string;
function mount(onDone: () => void): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<LaunchIntro onDone={onDone} />);
  });
  return r;
}
const intro = (r: ReactTestRenderer) => r.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'launch-intro')[0];

const fs = require('fs') as { readFileSync: (path: string, enc: 'utf8') => string };

describe('LaunchIntro exit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduce = false;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('hands the take-off to native-driver timings and finishes once they end', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onDone = jest.fn();
    const screen = mount(onDone);
    act(() => jest.advanceTimersByTime(TIMING.exit.start - 100));
    expect(timing).not.toHaveBeenCalled();
    expect(intro(screen).props.pointerEvents).toBe('auto');

    act(() => jest.advanceTimersByTime(200));
    expect(timing).toHaveBeenCalledTimes(2);
    for (const [, config] of timing.mock.calls) expect(config.useNativeDriver).toBe(true);
    // Touches pass to the app as soon as the panel starts to leave.
    expect(intro(screen).props.pointerEvents).toBe('none');
    expect(onDone).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(TIMING.exit.ms + 200));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops redrawing during the take-off', () => {
    const onDone = jest.fn();
    const screen = mount(onDone);
    act(() => jest.advanceTimersByTime(TIMING.exit.start + 40));
    const before = screen.toJSON();
    act(() => jest.advanceTimersByTime(200));
    // The tree is identical frame to frame; only native transforms move.
    expect(JSON.stringify(screen.toJSON())).toBe(JSON.stringify(before));
  });

  it('fades on the native thread with Reduce Motion', () => {
    mockReduce = true;
    const timing = jest.spyOn(Animated, 'timing');
    const onDone = jest.fn();
    mount(onDone);
    act(() => jest.advanceTimersByTime(TIMING.reducedHold + 50));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1].useNativeDriver).toBe(true);
    act(() => jest.advanceTimersByTime(REDUCED_INTRO_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the whole intro under two and a half seconds', () => {
    expect(INTRO_MS).toBeLessThanOrEqual(2500);
  });

  it('matches the JS frames: the plane ends where introFrame flies it, the panel clears the screen', () => {
    const layout = introLayout(390, 844);
    const heading = introFrame(TIMING.exit.start).plane.heading;
    const plan = exitPlan(layout, heading, 844);
    const startAt = introFrame(TIMING.exit.start).plane.at;
    const endAt = introFrame(TIMING.exit.start + TIMING.exit.ms).plane.at;
    expect(plan.flyX).toBeCloseTo((endAt.x - startAt.x) * layout.scale, 3);
    expect(plan.flyY).toBeCloseTo((endAt.y - startAt.y) * layout.scale, 3);
    expect(plan.liftY).toBeLessThan(-844);
    expect(plan.liftDelay + plan.liftMs).toBe(TIMING.exit.ms);
  });

  it('never drives the lift from a JS frame loop', () => {
    const src = fs.readFileSync(`${__dirname}/../LaunchIntro.tsx`, 'utf8');
    expect(src).not.toMatch(/translateY: -f\.lift/);
    expect(src).not.toMatch(/react-native-reanimated/);
  });
});
