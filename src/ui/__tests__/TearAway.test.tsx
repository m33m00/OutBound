/**
 * Saving a route tears the route card's own header off along its perforation and drops it into My
 * Trips (round 126, John: "Can you have it actually tear off the perforated line on the flight card").
 */
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc, type Itinerary } from '@/engine';
import { dragMs, TEAR_DRAG, type TearDrive } from '../tearMesh';

import { ResultRow } from '../ResultRow';
import { SaveRouteButton } from '../SaveRouteButton';
import {
  CURL_MS,
  CURL_SLICES,
  CURL_TOTAL_DEG,
  curlAngles,
  curlTurn,
  slicePoses,
  FLY_MS,
  HOLD_MS,
  LIFT_MS,
  RIP_MS,
  SETTLE_MS,
  setMeshModuleForTests,
  TearAwayHost,
} from '../TearAway';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The swipe strip's native pan (round 134): keep its config so a test can play the gesture.
type PanCfg = {
  enabled?: boolean;
  activeOffsetX?: [number, number];
  failOffsetY?: [number, number];
  onActivate?: (e: object) => void;
  onUpdate?: (e: object) => void;
  onDeactivate?: (e: object) => void;
};
const mockPans: PanCfg[] = [];
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePanGesture: (config: PanCfg) => {
    mockPans.push(config);
    return {};
  },
}));

const NOW = Date.UTC(2026, 9, 19, 12);

async function itinerary() {
  const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
  const provider = createMemoryProvider(
    [
      { id: 'F1', airline: 'DL', flightNumber: '1902', from: 'BNA', to: 'DEN', departUtc: at('09:00'), arriveUtc: at('11:00') },
      { id: 'F2', airline: 'DL', flightNumber: '832', from: 'DEN', to: 'LAX', departUtc: at('12:30'), arriveUtc: at('15:00') },
    ],
    {
      F1: [{ source: 'reported', openSeats: 25, listed: 16, asOf: NOW }],
      F2: [{ source: 'reported', openSeats: 17, listed: 19, asOf: NOW }],
    },
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
  return it;
}

// Every view says where it is: the card near the top of a 390 x 760 screen, its header the top 90 points.
type Measured = (x: number, y: number, w: number, h: number) => void;
const measureCard = (cb: Measured) => cb(16, 200, 358, 300);
const measureHeader = (cb: Measured) => cb(16, 200, 358, 90);

describe('TearAway: the route card tears along its perforation when you save (round 126, John)', () => {
  let r: ReactTestRenderer | undefined;
  let route: Itinerary;
  beforeAll(async () => {
    route = await itinerary();
  });
  beforeEach(() => setMeshModuleForTests(null));
  afterAll(() => setMeshModuleForTests(undefined));
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  async function mount(saved: boolean, reduceMotion: boolean, onPress = jest.fn(), onSwipeSave?: () => void) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
    await act(async () => {
      r = create(
        <TearAwayHost>
          <ResultRow
            itinerary={route}
            selected
            large
            now={NOW}
            onPress={jest.fn()}
            topAction={<SaveRouteButton saved={saved} onPress={onPress} />}
            onSwipeSave={onSwipeSave}
          />
        </TearAwayHost>,
      );
    });
    // The mocked views measure nothing, so give each one a place on screen.
    for (const n of r!.root.findAll((x) => typeof x.instance?.measureInWindow === 'function')) {
      n.instance.measureInWindow = measureCard;
    }
    for (const n of r!.root.findAllByProps({ testID: 'ticket-stub' })) {
      if (typeof n.instance?.measureInWindow === 'function') n.instance.measureInWindow = measureHeader;
    }
    act(() => r!.root.findByProps({ testID: 'tear-away-layer' }).props.onLayout());
  }

  const press = () => act(() => r!.root.findByProps({ testID: 'save-route' }).props.onPress());
  const flying = () => r!.root.findAllByProps({ testID: 'tear-away' }).filter((n) => typeof n.type !== 'string');
  const cardOpacity = () => {
    const o = r!.root.findAllByProps({ testID: 'route-card-hold' })[0].props.style.opacity as
      | number
      | { __getValue: () => number };
    return typeof o === 'number' ? o : o.__getValue();
  };
  const holdOpacity = () => {
    const o = r!.root.findAllByProps({ testID: 'ticket-stub-hold' })[0].props.style.opacity as
      | number
      | { __getValue: () => number };
    return typeof o === 'number' ? o : o.__getValue();
  };

  it('stays short: pick up, curl, beat, rip, flight and settle take about a second and a half', () => {
    expect(LIFT_MS + CURL_MS + HOLD_MS + RIP_MS + FLY_MS + SETTLE_MS).toBeLessThanOrEqual(1600);
  });

  it('curls on an exponential: flat at the line, bending harder toward the free edge (round 130, John)', () => {
    // Since round 131 the curl comes toward you, so its turn is negative; its shape is the same.
    expect(CURL_TOTAL_DEG).toBeLessThan(0);
    const a = curlAngles().map(Math.abs);
    expect(a).toHaveLength(CURL_SLICES);
    // Each slice bends more than the one below it, and the growth itself grows: a curve, not a hinge.
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    for (let i = 2; i < a.length; i++) expect(a[i] - a[i - 1]).toBeGreaterThan(a[i - 1] - a[i - 2]);
    // Almost flat at the perforation, most of the turn near the top, all of it adding up to the total.
    expect(a[0]).toBeLessThan(2);
    expect(a[a.length - 1]).toBeGreaterThan(9);
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(Math.abs(CURL_TOTAL_DEG), 6);
    // Halfway up the stub it has turned only about a quarter of the way.
    expect(curlTurn(0.5) / CURL_TOTAL_DEG).toBeLessThan(0.3);
  });

  it('places the slices in one shared 3D space, so the stub really comes up toward you (rounds 130 and 131)', () => {
    const flatPoses = slicePoses(0, 92, 150);
    // Before the curl every slice sits where it is on the card.
    for (const p of flatPoses) {
      expect(p.turn).toBeCloseTo(0, 9);
      expect(p.shift).toBeCloseTo(0, 6);
      expect(p.scale).toBe(1);
    }
    const curled = slicePoses(1, 92, 150);
    // The bottom slice stays on the line; higher slices come closer to you and look bigger, more and more.
    expect(curled[0].shift).toBeCloseTo(0, 6);
    for (let i = 1; i < curled.length; i++) {
      expect(curled[i].depth).toBeLessThan(curled[i - 1].depth);
      expect(curled[i].scale).toBeGreaterThan(curled[i - 1].scale);
    }
    // Pulled up toward you but not over: the face of the ticket still shows.
    expect(curled[curled.length - 1].turn).toBeLessThan(0);
    expect(curled[curled.length - 1].turn).toBeGreaterThan(-90);
  });

  it('tapping Save flies a copy of the card header with a torn edge, and hides the real header meanwhile', async () => {
    const onPress = jest.fn();
    const start = jest.fn();
    jest.spyOn(Animated, 'sequence').mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });
    await mount(false, false, onPress);
    press();
    expect(onPress).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(flying().length).toBeGreaterThan(0);
    const piece = flying()[0];
    // The copy is the header itself: same times, a torn edge, and the bookmark already filled.
    expect(piece.findAllByProps({ testID: 'headline-row' }).length).toBeGreaterThan(0);
    expect(piece.findAllByProps({ testID: 'tear-edge' }).length).toBeGreaterThan(0);
    expect(piece.findAll((n) => n.props.name === 'bookmark.fill').length).toBeGreaterThan(0);
    expect(r!.root.findByProps({ testID: 'tear-away-layer' }).props.pointerEvents).toBe('none');
    // The real card hides while its copy bends and tears; the header stays put under it.
    expect(cardOpacity()).toBe(0);
    expect(holdOpacity()).toBe(1);
    // The copy has both halves: the top that tears off and the rest of the card.
    expect(r!.root.findAllByProps({ testID: 'tear-bottom' }).length).toBeGreaterThan(0);
    expect(piece.findAllByProps({ testID: 'leg-dot-seats' }).length).toBeGreaterThan(0);
  });

  it('pulls the stub toward you in slices and tears it off on a diagonal from the right notch (round 131, John)', async () => {
    jest.spyOn(Animated, 'sequence').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    await mount(false, false);
    press();
    const flat = (testID: string) =>
      [r!.root.findAllByProps({ testID })[0].props.style].flat(3).reduce((a, b) => ({ ...a, ...b }), {});
    // The stub is thin slices, each placed on the curve and turned a little further toward you than the last.
    const slices = r!.root.findAllByType(Animated.View).filter((n) => n.props.testID === 'curl-slice');
    expect(slices.length).toBe(CURL_SLICES);
    const sliceStyle = (n: (typeof slices)[number]) => [n.props.style].flat(3).reduce((a, b) => ({ ...a, ...b }), {});
    expect(sliceStyle(slices[0]).transformOrigin).toBe('center bottom');
    expect(sliceStyle(slices[0]).transform.map((t: object) => Object.keys(t)[0])).toEqual([
      'translateY',
      'scale',
      'perspective',
      'rotateX',
    ]);
    const turnOf = (n: (typeof slices)[number]) => {
      const out = sliceStyle(n).transform[3].rotateX._config.outputRange as string[];
      return parseFloat(out[out.length - 1]);
    };
    expect(turnOf(slices[slices.length - 1])).toBeLessThan(turnOf(slices[0]));
    expect(turnOf(slices[slices.length - 1])).toBeLessThan(0);
    // The whole card is picked up and held at an angle first.
    expect(flat('tear-away').transform.map((t: object) => Object.keys(t)[0])).toEqual([
      'perspective',
      'scale',
      'rotateX',
      'rotateY',
    ]);
    // The tear is hinged where it's still attached, at the bottom left, and swings up and out to the
    // right, turning counterclockwise, as it comes free; it grows a little as you pull it toward you.
    const rip = flat('tear-rip');
    expect(rip.transformOrigin).toBe('left bottom');
    const end = (k: string) => {
      const t = rip.transform.find((x: object) => k in x)[k]._config.outputRange;
      return t[t.length - 1];
    };
    expect(end('translateX')).toBeGreaterThan(0);
    expect(end('translateY')).toBeLessThan(0);
    expect(parseFloat(end('rotate'))).toBeLessThanOrEqual(-10);
    expect(parseFloat(end('rotate'))).toBeGreaterThanOrEqual(-20);
    expect(end('scale')).toBeGreaterThan(1);
    // The rest of the card tugs back, and the lifted stub casts a soft shadow on it.
    expect(flat('tear-bottom').transform.map((t: object) => Object.keys(t)[0])).toEqual(['translateY', 'rotate']);
    expect(r!.root.findAllByType(Animated.View).filter((n) => n.props.testID === 'tear-shadow').length).toBe(3);
    // The ragged edge shows hole by hole: the right teeth before the left ones.
    const edge = r!.root.findAllByProps({ testID: 'tear-edge' })[0];
    const teeth = edge.findAllByType(Animated.View);
    const startOf = (n: (typeof teeth)[number]) =>
      ([n.props.style].flat(3).find((x) => x?.opacity)?.opacity as { _config: { inputRange: number[] } })._config.inputRange[1];
    expect(teeth.length).toBeGreaterThan(10);
    expect(startOf(teeth[teeth.length - 1])).toBeLessThan(startOf(teeth[0]));
  });

  it('once it lands, the copy goes and the real header settles back onto the card', async () => {
    jest.spyOn(Animated, 'sequence').mockReturnValue({
      start: (done?: (r: { finished: boolean }) => void) => done?.({ finished: true }),
      stop: jest.fn(),
      reset: jest.fn(),
    });
    const settle = jest.spyOn(Animated, 'timing');
    await mount(false, false);
    press();
    expect(flying()).toHaveLength(0);
    expect(cardOpacity()).toBe(1);
    expect(settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: SETTLE_MS }));
  });

  it('taking a saved route back out tears nothing', async () => {
    await mount(true, false);
    press();
    expect(flying()).toHaveLength(0);
    expect(holdOpacity()).toBe(1);
  });

  it('with Reduce Motion on, Save just saves and the card stays whole', async () => {
    const onPress = jest.fn();
    await mount(false, true, onPress);
    press();
    expect(onPress).toHaveBeenCalled();
    expect(flying()).toHaveLength(0);
    expect(holdOpacity()).toBe(1);
  });

  it('Save still works on a screen with no host', async () => {
    const onPress = jest.fn();
    await act(async () => {
      r = create(<SaveRouteButton saved={false} onPress={onPress} />);
    });
    press();
    expect(onPress).toHaveBeenCalled();
  });

  it('the route card no longer explains its seat circles under the legs; the Map key does (round 132, John)', async () => {
    await mount(false, false);
    expect(r!.root.findAllByProps({ testID: 'seat-circle-hint' })).toHaveLength(0);
  });

  describe('the paper tear (round 132, John: "the paper would pull back (arc) and tear")', () => {
    const paperProps: { current: Record<string, unknown> | null } = { current: null };
    const PaperStub = (props: Record<string, unknown>) => {
      paperProps.current = props;
      return <Text testID="paper-tear">paper</Text>;
    };
    function useMesh(image: unknown) {
      const snapshotView = jest.fn(() => Promise.resolve(image));
      setMeshModuleForTests({ TearMeshFlight: PaperStub, snapshotView } as unknown as Parameters<
        typeof setMeshModuleForTests
      >[0]);
      jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });
      return snapshotView;
    }

    it('bends a picture of the real card: hides the card, tears it as paper, then settles the header back', async () => {
      const snapshotView = useMesh({ picture: true });
      const settle = jest.spyOn(Animated, 'timing');
      await mount(false, false);
      press();
      await act(async () => {});
      expect(snapshotView).toHaveBeenCalled();
      expect(r!.root.findAllByProps({ testID: 'paper-tear' }).length).toBeGreaterThan(0);
      // No sliced copy, and the real card hides while its picture tears.
      expect(flying()).toHaveLength(0);
      expect(cardOpacity()).toBe(0);
      // The perforation sits at the header's bottom: 90 points down the card.
      const geometry = paperProps.current!.geometry as { perf: number; width: number; height: number };
      expect(geometry).toMatchObject({ perf: 90, width: 358, height: 300 });
      act(() => (paperProps.current!.onDone as () => void)());
      expect(r!.root.findAllByProps({ testID: 'paper-tear' })).toHaveLength(0);
      expect(cardOpacity()).toBe(1);
      expect(settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: SETTLE_MS }));
    });

    it('falls back to the sliced tear when the picture can’t be taken', async () => {
      useMesh(null);
      jest.spyOn(Animated, 'sequence').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
      await mount(false, false);
      press();
      await act(async () => {});
      expect(r!.root.findAllByProps({ testID: 'paper-tear' })).toHaveLength(0);
      expect(flying().length).toBeGreaterThan(0);
    });

    describe('swipe left on the perforation to save (round 133, John)', () => {
      const W = 358;
      const ev = (translationX: number, velocityX = 0, canceled = false) => ({ translationX, velocityX, canceled });
      async function swipeMount(onSwipeSave = jest.fn(), reduceMotion = false) {
        mockPans.length = 0;
        await mount(false, reduceMotion, jest.fn(), onSwipeSave);
        const strip = r!.root.findAll((n) => n.props.testID === 'tear-swipe' && typeof n.props.onLayout === 'function')[0];
        act(() => strip.props.onLayout({ nativeEvent: { layout: { width: W } } }));
        const cfg = mockPans[mockPans.length - 1];
        return { cfg, onSwipeSave };
      }
      const drive = () => paperProps.current!.drive as TearDrive;
      // A swipe this far through, as the finger's move left.
      const at = (p: number) => -p * W * TEAR_DRAG.span;
      const activate = (cfg: PanCfg) =>
        act(async () => {
          cfg.onActivate!(ev(-12));
        });
      const letGo = (cfg: PanCfg, dx: number, vx = 0, canceled = false) =>
        act(() => {
          cfg.onDeactivate!(ev(dx, vx, canceled));
        });

      it('starts only on a swipe to the left, and leaves up and down to the scroll (round 134)', async () => {
        useMesh({ picture: true });
        const { cfg } = await swipeMount();
        expect(cfg.enabled).toBe(true);
        expect(cfg.activeOffsetX![0]).toBeLessThan(0);
        expect(cfg.activeOffsetX![1]).toBeGreaterThan(1000);
        expect(cfg.failOffsetY![0]).toBeLessThan(0);
        expect(cfg.failOffsetY![1]).toBeGreaterThan(0);
      });

      it('lets the finger drive the paper tear, and tears it free and saves when let go past the middle', async () => {
        useMesh({ picture: true });
        const { cfg, onSwipeSave } = await swipeMount();
        await activate(cfg);
        expect(r!.root.findAllByProps({ testID: 'paper-tear' }).length).toBeGreaterThan(0);
        expect(cardOpacity()).toBe(0);
        expect(drive().mode).toBe('drag');
        act(() => {
          cfg.onUpdate!(ev(at(0.5)));
        });
        expect(drive().target).toBeCloseTo(dragMs(0.5));
        letGo(cfg, at(0.7));
        expect(drive().mode).toBe('finish');
        expect(onSwipeSave).toHaveBeenCalledTimes(1);
        act(() => (paperProps.current!.onDone as () => void)());
        expect(cardOpacity()).toBe(1);
      });

      it('lays the paper back down and saves nothing when let go too soon', async () => {
        useMesh({ picture: true });
        const { cfg, onSwipeSave } = await swipeMount();
        await activate(cfg);
        letGo(cfg, at(0.3));
        expect(drive().mode).toBe('cancel');
        expect(onSwipeSave).not.toHaveBeenCalled();
        act(() => (paperProps.current!.onCancel as () => void)());
        expect(r!.root.findAllByProps({ testID: 'paper-tear' })).toHaveLength(0);
        expect(cardOpacity()).toBe(1);
        // And the card can tear again.
        await activate(cfg);
        expect(r!.root.findAllByProps({ testID: 'paper-tear' }).length).toBeGreaterThan(0);
      });

      it('saves on a quick flick left once the rip has started, but not when the touch is cancelled', async () => {
        useMesh({ picture: true });
        const { cfg, onSwipeSave } = await swipeMount();
        await activate(cfg);
        letGo(cfg, at(0.8), 0, true);
        expect(onSwipeSave).not.toHaveBeenCalled();
        await activate(cfg);
        // 1200 points a second to the left.
        letGo(cfg, at(0.35), -1200);
        expect(onSwipeSave).toHaveBeenCalledTimes(1);
      });

      it('still saves with Reduce Motion on, without the tear', async () => {
        useMesh({ picture: true });
        const { cfg, onSwipeSave } = await swipeMount(jest.fn(), true);
        await activate(cfg);
        letGo(cfg, at(0.8));
        expect(onSwipeSave).toHaveBeenCalledTimes(1);
        expect(r!.root.findAllByProps({ testID: 'paper-tear' })).toHaveLength(0);
      });

      it('has no swipe once the route is saved', async () => {
        await mount(true, false);
        expect(r!.root.findAll((n) => n.props.testID === 'tear-swipe')).toHaveLength(0);
      });
    });
  });
});
