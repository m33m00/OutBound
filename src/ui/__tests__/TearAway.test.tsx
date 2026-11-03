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
  BEND_MS,
  BOTTOM_BEND_DEG,
  farEdgeScale,
  FLY_MS,
  HOLD_MS,
  LIFT_MS,
  RIP_MS,
  SETTLE_MS,
  TearAwayHost,
  TOP_BEND_DEG,
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

  it('stays short: pick up, bend, beat, rip, flight and settle take under 1.5s', () => {
    expect(LIFT_MS + BEND_MS + HOLD_MS + RIP_MS + FLY_MS + SETTLE_MS).toBeLessThan(1500);
  });

  it('bends in real 3D: each half visibly narrows as it turns away, not just squashes (round 129, John)', () => {
    // A header about 90 points tall and a body about 220 tall, at full bend.
    expect(farEdgeScale(90, TOP_BEND_DEG)).toBeLessThan(0.9);
    expect(farEdgeScale(220, BOTTOM_BEND_DEG)).toBeLessThan(0.82);
    // Flat would be no narrowing at all.
    expect(farEdgeScale(90, 0)).toBe(1);
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

  it('bends both halves back at the perforation and rips from left to right (rounds 127 to 129, John)', async () => {
    jest.spyOn(Animated, 'sequence').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
    await mount(false, false);
    press();
    const flat = (testID: string) =>
      [r!.root.findAllByProps({ testID })[0].props.style].flat(3).reduce((a, b) => ({ ...a, ...b }), {});
    // Both halves turn around the perforation with a close perspective: the top back from its bottom
    // edge, the rest of the card the other way from its top edge.
    const top = flat('tear-peel');
    expect(top.transformOrigin).toBe('center bottom');
    expect(top.transform.map((t: object) => Object.keys(t)[0])).toEqual(['perspective', 'rotateX']);
    const bottom = flat('tear-bottom');
    expect(bottom.transformOrigin).toBe('center top');
    expect(bottom.transform.map((t: object) => Object.keys(t)[0])).toEqual(['perspective', 'rotateX']);
    // The whole card is picked up and tilted first.
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
