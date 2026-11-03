import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SaveRouteButton } from '../SaveRouteButton';
import { FLY_MS, TEAR_MS, TearAwayHost } from '../TearAway';

// Every view reports where it sits: Save near the top right, the screen 390 x 760.
const nodeMock = () => ({
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(300, 120, 44, 44),
});

function render(saved: boolean, onPress = jest.fn()) {
  return create(
    <TearAwayHost>
      <Text>Results</Text>
      <SaveRouteButton saved={saved} onPress={onPress} ticket={{ title: 'DAL to LAX', sub: '6:05 AM – 9:40 AM' }} />
    </TearAwayHost>,
    { createNodeMock: nodeMock },
  );
}

describe('TearAway: saving tears a ticket off into My Trips (round 125, John)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  async function mount(saved: boolean, reduceMotion: boolean, onPress = jest.fn()) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
    await act(async () => {
      r = render(saved, onPress);
    });
    // The mocked views measure nothing, so give each one a place on screen.
    for (const n of r!.root.findAll((x) => typeof x.instance?.measureInWindow === 'function')) {
      n.instance.measureInWindow = nodeMock().measureInWindow;
    }
    act(() => r!.root.findByProps({ testID: 'tear-away-layer' }).props.onLayout());
  }

  const press = () => act(() => r!.root.findByProps({ testID: 'save-route' }).props.onPress());

  it('is quick: the whole tear and flight stays well under a second', () => {
    expect(TEAR_MS + FLY_MS).toBeLessThan(800);
  });

  it('tapping Save pops a little ticket out, tears its stub and flies it off, ignoring touches', async () => {
    const onPress = jest.fn();
    // Hold the animation mid-flight so the ticket is still on screen to look at.
    const start = jest.fn();
    const sequence = jest.spyOn(Animated, 'sequence').mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });
    await mount(false, false, onPress);
    press();
    expect(onPress).toHaveBeenCalled();
    const layer = r!.root.findByProps({ testID: 'tear-away-layer' });
    expect(layer.props.pointerEvents).toBe('none');
    expect(r!.root.findAllByProps({ testID: 'tear-away' }).length).toBeGreaterThan(0);
    expect(r!.root.findAllByProps({ testID: 'tear-stub' }).length).toBeGreaterThan(0);
    const texts = r!.root.findAllByType(Text).map((t) => t.props.children);
    expect(texts).toContain('DAL to LAX');
    expect(sequence).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
  });

  it('clears itself once the flight lands', async () => {
    jest
      .spyOn(Animated, 'sequence')
      .mockReturnValue({
        start: (done?: (r: { finished: boolean }) => void) => done?.({ finished: true }),
        stop: jest.fn(),
        reset: jest.fn(),
      });
    await mount(false, false);
    press();
    expect(r!.root.findAllByProps({ testID: 'tear-away' })).toHaveLength(0);
  });

  it('taking a saved route back out does not fly a ticket', async () => {
    await mount(true, false);
    press();
    expect(r!.root.findAllByProps({ testID: 'tear-away' })).toHaveLength(0);
  });

  it('with Reduce Motion on, Save just saves: no flight at all', async () => {
    const onPress = jest.fn();
    await mount(false, true, onPress);
    press();
    expect(onPress).toHaveBeenCalled();
    expect(r!.root.findAllByProps({ testID: 'tear-away' })).toHaveLength(0);
  });

  it('Save still works on a screen with no host', async () => {
    const onPress = jest.fn();
    await act(async () => {
      r = create(<SaveRouteButton saved={false} onPress={onPress} ticket={{ title: 'DAL to LAX' }} />, {
        createNodeMock: nodeMock,
      });
    });
    press();
    expect(onPress).toHaveBeenCalled();
  });
});
