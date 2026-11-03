/**
 * Saving a route tears the route card's own header off along its perforation and drops it into My
 * Trips (round 126, John: "Can you have it actually tear off the perforated line on the flight card").
 */
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc, type Itinerary } from '@/engine';

import { ResultRow, SEAT_CIRCLE_HINT } from '../ResultRow';
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
  TearAwayHost,
} from '../TearAway';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  afterEach(() => {
    act(() => r?.unmount());
    jest.restoreAllMocks();
  });

  async function mount(saved: boolean, reduceMotion: boolean, onPress = jest.fn()) {
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
    const a = curlAngles();
    expect(a).toHaveLength(CURL_SLICES);
    // Each slice bends more than the one below it, and the growth itself grows: a curve, not a hinge.
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    for (let i = 2; i < a.length; i++) expect(a[i] - a[i - 1]).toBeGreaterThan(a[i - 1] - a[i - 2]);
    // Almost flat at the perforation, most of the turn near the top, all of it adding up to the total.
    expect(a[0]).toBeLessThan(2);
    expect(a[a.length - 1]).toBeGreaterThan(15);
    expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(CURL_TOTAL_DEG, 6);
    // Halfway up the stub it has turned only about a sixth of the way.
    expect(curlTurn(0.5) / CURL_TOTAL_DEG).toBeLessThan(0.2);
  });

  it('places the slices in one shared 3D space, so the stub really rolls back (round 130)', () => {
    const flatPoses = slicePoses(0, 92, 150);
    // Before the curl every slice sits where it is on the card.
    for (const p of flatPoses) {
      expect(p.turn).toBe(0);
      expect(p.shift).toBeCloseTo(0, 6);
      expect(p.scale).toBe(1);
    }
    const curled = slicePoses(1, 92, 150);
    // The bottom slice stays on the line; higher slices sit deeper and look smaller, deeper and deeper.
    expect(curled[0].shift).toBeCloseTo(0, 6);
    for (let i = 1; i < curled.length; i++) {
      expect(curled[i].depth).toBeGreaterThan(curled[i - 1].depth);
      expect(curled[i].scale).toBeLessThan(curled[i - 1].scale);
    }
    // The free edge rolls over past upright, so its back shows.
    expect(curled[curled.length - 1].turn).toBeGreaterThan(90);
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

  it('curls the stub back in slices and rips from left to right (rounds 127 to 130, John)', async () => {
    jest.spyOn(Animated, 'sequence').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    await mount(false, false);
    press();
    const flat = (testID: string) =>
      [r!.root.findAllByProps({ testID })[0].props.style].flat(3).reduce((a, b) => ({ ...a, ...b }), {});
    // The stub is thin slices, each placed on the curve and turned a little further back than the last.
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
    expect(turnOf(slices[slices.length - 1])).toBeGreaterThan(turnOf(slices[0]));
    // The whole card is picked up and held at an angle first.
    expect(flat('tear-away').transform.map((t: object) => Object.keys(t)[0])).toEqual([
      'perspective',
      'scale',
      'rotateX',
      'rotateY',
    ]);
    // The rip is hinged where it's still attached, at the bottom right.
    expect(flat('tear-rip').transformOrigin).toBe('right bottom');
    // The ragged edge shows hole by hole: the left teeth before the right ones.
    const edge = r!.root.findAllByProps({ testID: 'tear-edge' })[0];
    const teeth = edge.findAllByType(Animated.View);
    const startOf = (n: (typeof teeth)[number]) =>
      ([n.props.style].flat(3).find((x) => x?.opacity)?.opacity as { _config: { inputRange: number[] } })._config.inputRange[1];
    expect(teeth.length).toBeGreaterThan(10);
    expect(startOf(teeth[0])).toBeLessThan(startOf(teeth[teeth.length - 1]));
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

  it('the route card says how to read its seat circles (round 126, John)', async () => {
    await mount(false, false);
    const hint = r!.root.findByProps({ testID: 'seat-circle-hint' });
    expect(hint.findByType(Text).props.children).toBe(SEAT_CIRCLE_HINT);
  });
});
