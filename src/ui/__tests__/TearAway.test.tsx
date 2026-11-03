/**
 * Saving a route tears the route card's own header off along its perforation and drops it into My
 * Trips (round 126, John: "Can you have it actually tear off the perforated line on the flight card").
 */
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc, type Itinerary } from '@/engine';

import { ResultRow, SEAT_CIRCLE_HINT } from '../ResultRow';
import { SaveRouteButton } from '../SaveRouteButton';
import { FLY_MS, SETTLE_MS, TEAR_MS, TearAwayHost, WOBBLE_MS } from '../TearAway';

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

// Every view says where it is: the header near the top, the screen 390 x 760.
const measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) => cb(16, 200, 358, 80);

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
      n.instance.measureInWindow = measureInWindow;
    }
    act(() => r!.root.findByProps({ testID: 'tear-away-layer' }).props.onLayout());
  }

  const press = () => act(() => r!.root.findByProps({ testID: 'save-route' }).props.onPress());
  const flying = () => r!.root.findAllByProps({ testID: 'tear-away' }).filter((n) => typeof n.type !== 'string');
  const holdOpacity = () => {
    const o = r!.root.findAllByProps({ testID: 'ticket-stub-hold' })[0].props.style.opacity as
      | number
      | { __getValue: () => number };
    return typeof o === 'number' ? o : o.__getValue();
  };

  it('is quick: wobble, rip, flight and settle stay under about a second', () => {
    expect(WOBBLE_MS + TEAR_MS + FLY_MS + SETTLE_MS).toBeLessThanOrEqual(1000);
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
    expect(holdOpacity()).toBe(0);
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
