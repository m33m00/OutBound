import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { flightLookupKey, type FlightStatus } from '@/live';
import { legLookup, rowStatus } from '@/search/statusTags';
import { colors, inkColors } from '@/theme';

import { connectionText, dotSeats, measurePerfOn, ResultRow } from '../ResultRow';
import { StatusTag } from '../StatusTag';
import { TIER_FG } from '../tierColors';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);

/** BNA 9:00 AM -> DEN on AA 1, then DEN -> LAX on AA 2: two legs, so each box shows its times. */
async function twoLegItinerary() {
  const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
  const provider = createMemoryProvider(
    [
      { id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'DEN', departUtc: at('09:00'), arriveUtc: at('11:00') },
      { id: 'F2', airline: 'AA', flightNumber: '2', from: 'DEN', to: 'LAX', departUtc: at('12:30'), arriveUtc: at('15:00') },
    ],
    {
      F1: [{ source: 'reported', openSeats: 4, listed: 9, asOf: NOW }],
      F2: [{ source: 'reported', openSeats: 6, listed: 2, asOf: NOW }],
    },
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
  return it;
}

async function fullItinerary() {
  const departUtc = zonedToUtc('2026-10-20', '09:00', 'America/Chicago');
  const provider = createMemoryProvider(
    [{ id: 'F1', airline: 'AA', flightNumber: '1', from: 'BNA', to: 'LAX', departUtc, arriveUtc: departUtc + 260 * 60_000 }],
    { F1: [{ source: 'reported', openSeats: 4, listed: 9, asOf: NOW }] },
  );
  const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
  return it;
}

describe('ResultRow', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('renders no chance word, just colored seat numbers on the route line, and one accessible label (round 140)', async () => {
    const it = await fullItinerary();
    const onPress = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={onPress} />);
    });
    const root = r!.root;
    const button = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(button.props.accessibilityLabel).toContain('Full route');
    expect(button.props.accessibilityState).toEqual({ selected: false });
    // No weather/FAA pill on the row (John, 2026-11-02: "Likely Delays is a dumb callout/container").
    expect(root.findAll((n) => n.props.testID === 'badge-slot')).toHaveLength(0);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    // Round 140 (John: "Just color and seat availability"): no chance word in the top right; each leg's
    // seat numbers sit over its stretch of the route line instead.
    expect(texts).not.toContain('Full');
    expect(texts.some((t) => /Likely|Long.shot|Maybe|Easy/.test(String(t)))).toBe(false);
    // Round 141: the top right holds the stops and trip length, so the route line gets the whole width.
    const topRight = root.findAll((n) => n.props.testID === 'top-right' && typeof n.type === 'string');
    expect(topRight).toHaveLength(1);
    expect(topRight[0].findAll((n) => n.props.testID === 'row-stops' && typeof n.type === 'string')).toHaveLength(1);
    const routeLine = root.find((n) => n.props.testID === 'mini-route' && typeof n.type === 'string');
    expect(routeLine.findAll((n) => n.props.testID === 'row-stops')).toHaveLength(0);
    const labels = root.findAll((n) => n.props.testID === 'mini-route-leg-label' && typeof n.type === 'string');
    expect(labels.map((n) => n.props.children)).toEqual(['4/9']);
    expect(texts.some((t) => / seats · \d+ listed/.test(String(t)))).toBe(false);
    // Seat ages are hidden for now (round 124, John); VoiceOver still hears them.
    expect(root.findAll((n) => n.props.testID === 'seat-age')).toHaveLength(0);
    expect(root.findAll((n) => n.props.testID === 'flights-line' && typeof n.type === 'string').length).toBe(1);
    expect(root.findAll((n) => n.props.testID === 'seat-summary')).toHaveLength(0);
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledWith(it.id);
  });

  it('opens into route card A when selected: no chance pill up top, no seat age (rounds 66, 140)', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    // No seat age on the card while ages are hidden (round 124, John).
    expect(texts.filter((t) => /reported/i.test(String(t)))).toHaveLength(0);
    // Round 140: no chance pill under the times any more; the legs' colors and numbers say it.
    expect(r!.root.findAll((n) => n.props.testID === 'headline-row')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'seat-summary')).toHaveLength(0);
    // The stop count sits on top of the trip length (round 124).
    const stack = r!.root.findAll((n) => n.props.testID === 'row-stops' && typeof n.type === 'string')[0];
    const stackTexts = stack
      .findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string')
      .map((n) => n.props.children);
    expect(stackTexts[0]).toMatch(/stop|Nonstop/);
    expect(stack.findAll((n) => n.props.testID === 'row-trip-length' && typeof n.type === 'string')).toHaveLength(1);
    expect(r!.root.findAll((n) => n.props.testID === 'flights-line').length).toBe(0);
    const button = r!.root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(button.props.accessibilityHint).toBe('Closes the route card');
  });

  it('no "Leaves from …, 35 min from …" line under a route from another airport in the area (round 64, John)', async () => {
    const it = { ...(await fullItinerary()), requestedOrigin: 'DFW', originTransferMin: 35 };
    for (const selected of [false, true]) {
      await act(async () => {
        r = create(<ResultRow itinerary={it} selected={selected} now={NOW} onPress={jest.fn()} />);
      });
      const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => String(n.props.children));
      expect(texts.some((t) => t.includes('m from') || t.startsWith('Leaves from'))).toBe(false);
      // The route still names the airport it leaves from: the route line, or each flight's line on the card.
      const all = r!.root
        .findAll((n) => typeof n.type === 'string' && n.props.children != null)
        .map((n) =>
          [n.props.children]
            .flat()
            .filter((x: unknown) => typeof x === 'string')
            .join(''),
        );
      expect(all.some((t) => t === 'BNA' || t.startsWith('BNA →') || t.includes('BNA\u00a0→'))).toBe(true);
    }
  });

  it('no Likely delays pill on the row; the details stay a VoiceOver action (John, 2026-11-02)', async () => {
    const it = await fullItinerary();
    const onImpact = jest.fn();
    const impact = {
      level: 'likelyDelays' as const,
      asOf: new Date(NOW - 5 * 60_000).toISOString(),
      stale: false,
      stations: [
        {
          code: 'LAX',
          role: 'destination' as const,
          level: 'likelyDelays' as const,
          reasons: [{ source: 'FAA' as const, text: 'Ground stop', level: 'likelyDelays' as const }],
          asOf: new Date(NOW - 5 * 60_000).toISOString(),
          stale: false,
          noForecast: false,
        },
      ],
    };
    await act(async () => {
      r = create(
        <ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impact={impact} onImpactPress={onImpact} />,
      );
    });
    const root = r!.root;
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Likely delays at LAX: Ground stop');
    expect(row.props.accessibilityActions).toEqual([{ name: 'impact', label: 'Delay and weather details' }]);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'impact' } }));
    expect(onImpact).toHaveBeenCalledWith(it.id);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts.some((t) => String(t).startsWith('Likely delays'))).toBe(false);
  });

  it('reaches each leg flight status as a VoiceOver action; stops line skips the airports', async () => {
    const it = await fullItinerary();
    const onLeg = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} onLegPress={onLeg} />);
    });
    const row = r!.root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityActions).toEqual([{ name: 'leg-0', label: 'Flight status, AA 1' }]);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'leg-0' } }));
    expect(onLeg).toHaveBeenCalledWith(it.legs[0].flight);
    const texts = r!.root.findAll((n) => n.props.children != null).flatMap((n) => [n.props.children].flat());
    expect(texts.some((t) => typeof t === 'string' && t === 'Nonstop')).toBe(true);
  });

  it("connections: the headline is the weakest leg's chance word; legs are one line each (round 66)", async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {
        A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }],
        B: [{ source: 'reported', openSeats: 6, listed: 4, asOf: NOW }],
      },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    // No route-wide chance word (round 140); each leg keeps its own color.
    expect(r!.root.findAll((n) => n.props.testID === 'seat-summary')).toHaveLength(0);
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    // No seat age on the card or its legs while ages are hidden (round 124, John).
    expect(texts.filter((t) => t.includes('reported just now'))).toEqual([]);
    // The route card names the connection between the legs.
    const all = r!.root
      .findAll((n) => typeof n.type === 'string' && n.props.children != null)
      .map((n) => [n.props.children].flat().join(''));
    expect(all).toContain('1h 30m connection at DEN');
    // Stops read as a timeline (round 56): one dot per leg in its seat color, no second seat chip.
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string');
    expect(timeline.length).toBe(1);
    expect(timeline[0].findAll((n) => n.props.testID === 'leg-dot' && typeof n.type === 'string').length).toBe(2);
    // Each leg shows its own departure time over its airports, each in a pill (round 132, John).
    expect(all).toContain('8:00\u00a0AM');
    const firstBox = r!.root.findAll((n) => n.props.testID === 'leg-box' && typeof n.type === 'string')[0];
    const codes = firstBox
      .findAll((n) => n.props.testID === 'leg-code' && typeof n.type === 'string')
      .flatMap((n) => n.findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children as string));
    expect([...new Set(codes)]).toEqual(['BNA', 'DEN']);
  });

  it('connection label sits at the middle of the line between the dots, even when a leg wraps (John, 2026-11-01)', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {
        A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }],
        B: [{ source: 'reported', openSeats: 6, listed: 4, asOf: NOW }],
      },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    const flat = (style: unknown) => Object.assign({}, ...([style] as unknown[]).flat(3).filter(Boolean));
    const connection = () => r!.root.findAll((n) => n.props.testID === 'leg-connection' && typeof n.type === 'string')[0];
    const legs = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.onLayout === 'function');
    expect(legs.length).toBe(2);
    // Unmeasured or equal boxes: same space above and below the label.
    const pads = () => {
      const st = flat(connection().props.style);
      return [st.paddingTop as number, st.paddingBottom as number];
    };
    const [top, base] = pads();
    expect(base).toBe(top);
    // Each dot sits at its box's middle, so when the first box grows the line between the dots
    // grows by half that, and so does the space under the label, keeping it at the middle.
    const grow = (i: number, h: number) => act(() => legs[i].props.onLayout({ nativeEvent: { layout: { height: h } } }));
    grow(0, 100);
    const tall = pads()[1];
    expect(tall).toBeGreaterThan(base);
    grow(0, 130);
    expect(pads()[1] - tall).toBe(15);
    // Same-size boxes balance out again.
    grow(1, 130);
    expect(pads()[0]).toBe(pads()[1]);
    // Each flight is its own box (John, 2026-11-01): the first one's tag and flight sit above
    // its time, the last one's below it.
    const boxes = r!.root.findAll((n) => n.props.testID === 'leg-box' && typeof n.type === 'string');
    expect(boxes).toHaveLength(2);
    const inBox = (b: (typeof boxes)[number]) =>
      b
        .findAll((n) => typeof n.type === 'string' && (n.props.testID === 'leg-flight' || n.props.testID === 'leg-line'))
        .map((n) => (n.props.testID === 'leg-flight' ? 'flight' : 'time'))
        .filter((t, i, a) => a.indexOf(t) === i);
    // Every box has the same order: the two ends (times over airports), then the flight chip (John, 2026-11-02).
    expect(inBox(boxes[0])).toEqual(['time', 'flight']);
    expect(inBox(boxes[1])).toEqual(['time', 'flight']);
    expect(r!.root.findAll((n) => n.props.testID === 'leg-dot' && typeof n.type === 'string')).toHaveLength(2);
  });

  it('each flight box is the tap target, with no caret (John, 2026-11-01)', async () => {
    const it = await fullItinerary();
    const onLeg = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} onLegPress={onLeg} />);
    });
    const box = r!.root.findAll((n) => n.props.testID === 'leg-box' && typeof n.props.onPress === 'function')[0];
    expect(box.props.accessibilityLabel).toMatch(/^Flight status, AA 1/);
    act(() => box.props.onPress());
    expect(onLeg).toHaveBeenCalledWith(it.legs[0].flight);
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    expect(timeline.findAll((n) => n.props.name === 'chevron.right')).toHaveLength(0);
  });

  it('grays the route line seat numbers on a route that already left, keeping the numbers', async () => {
    const it = await fullItinerary();
    const status = { legs: [], risks: [], dimmed: true, canceled: false, spoken: ['Departed'] };
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={status} />);
    });
    const text = r!.root.findAll((n) => n.props.testID === 'mini-route-leg-label' && typeof n.type === 'string')[0];
    const flat = (style: unknown) => Object.assign({}, ...([style] as unknown[]).flat(3).filter(Boolean));
    expect(flat(text.props.style).color).toBe(colors.light[TIER_FG.unknown]);
    expect(text.props.children).toBe('4/9');
    const seg = r!.root.findAll((n) => n.props.testID === 'mini-route-seg' && typeof n.type === 'string')[0];
    expect(flat(seg.props.style).backgroundColor).toBe(colors.light.unknown);
  });

  it('the slim row renders no stray text outside a Text (a broken comment once leaked into the layout)', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impactLoading />);
    });
    const views = r!.root.findAll((n) => (n.type as unknown) === 'View');
    for (const v of views) {
      for (const child of [v.props.children].flat(5)) expect(typeof child === 'string' ? child : '').toBe('');
    }
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).not.toContain('Checking…');
  });

  const live = (it: Awaited<ReturnType<typeof fullItinerary>>, state: FlightStatus['state'], lateMin = 0): FlightStatus => {
    const f = it.legs[0].flight;
    const d = new Date(f.departUtc).toISOString();
    return {
      flightNumber: 'AA1',
      state,
      departure: {
        airport: 'BNA',
        scheduledUtc: d,
        estimatedUtc: lateMin ? new Date(f.departUtc + lateMin * 60_000).toISOString() : null,
        actualUtc: null,
        delayMin: lateMin || null,
        terminal: null,
        gate: null,
      },
      arrival: {
        airport: 'LAX',
        scheduledUtc: null,
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      providerUpdatedAt: null,
    };
  };
  const statusFor = (it: Awaited<ReturnType<typeof fullItinerary>>, s: FlightStatus) =>
    rowStatus(
      it,
      { [flightLookupKey(legLookup(it.legs[0].flight))]: s },
      { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 },
    );
  const strings = (root: ReactTestRenderer['root']) =>
    root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('a moved time is tinted by how far it moved: yellow, orange, red (John, 2026-11-02)', async () => {
    const it = await fullItinerary();
    const colorOf = (id: string) => {
      const n = r!.root.findAll((x) => x.props.testID === id && typeof x.type === 'string')[0];
      return n ? ([n.props.style].flat(3).find((st: { color?: string } | null) => st?.color)?.color ?? null) : undefined;
    };
    for (const [late, token] of [
      [10, 'timeSlight'],
      [25, 'timeLate'],
      [60, 'timeVeryLate'],
    ] as const) {
      await act(async () => {
        r = create(
          <ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'delayed', late))} />,
        );
      });
      expect(colorOf('row-new-depart')).toBe(colors.light[token]);
      expect(colorOf('row-new-arrive')).toBe(colors.light[token]);
      // A nonstop's box doesn't repeat the times (John, 2026-11-02).
      expect(colorOf('leg-clock')).toBeUndefined();
      await act(async () => r!.unmount());
      r = undefined;
    }
  });

  it('delayed: violet tag, old time struck through, new time, spoken in the row label', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(
        <ResultRow
          itinerary={it}
          selected={false}
          now={NOW}
          onPress={jest.fn()}
          status={statusFor(it, live(it, 'delayed', 25))}
        />,
      );
    });
    const root = r!.root;
    expect(strings(root)).toContain('Delayed 25m');
    const struck = root.findAll(
      (n) =>
        (n.type as unknown) === 'Text' &&
        [n.props.style]
          .flat(3)
          .some((st: { textDecorationLine?: string } | undefined) => st?.textDecorationLine === 'line-through'),
    );
    // One small struck line above the times (not again on the leg line): the schedule, since a
    // 25-minute late departure lands about 25 minutes late too (John, 2026-11-02).
    expect(struck).toHaveLength(1);
    expect(struck[0].props.testID).toBe('row-was');
    const times = root.findAll((n) => n.props.testID === 'row-times' && typeof n.type === 'string')[0];
    const flat = (n: unknown): string =>
      typeof n === 'string'
        ? n
        : Array.isArray(n)
          ? n.map(flat).join('')
          : n && typeof n === 'object' && 'props' in n
            ? flat((n as { props: { children?: unknown } }).props.children)
            : '';
    // Each time keeps its number and AM/PM together (non-breaking space, design round 26).
    // The big line keeps only the times now, on one line, so a moved row never wraps (John, 2026-11-02).
    expect(flat(times.props.children)).toBe('9:25\u00a0AM – 11:45\u00a0AM');
    expect(flat(struck[0].props.children)).toBe('9:00\u00a0AM – 11:20\u00a0AM');
    // The flights stay on one line with one tag after them (John, 2026-10-31).
    const line = root.findAll((n) => n.props.testID === 'flights-line' && typeof n.type === 'string')[0];
    expect(line.props.style).toMatchObject({ flexDirection: 'row' });
    expect(line.findAll((n) => n.props.testID === 'row-tag' && typeof n.type === 'string')).toHaveLength(1);
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Delayed 25 minutes, was 9:00 AM, now 9:25 AM');
  });

  it('the seat chip stays on the times line at normal text size, struck or moved (John, 2026-11-02)', async () => {
    const it = await fullItinerary();
    const RN = jest.requireActual<typeof import('react-native')>('react-native');
    const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    try {
      await act(async () => {
        r = create(
          <ResultRow
            itinerary={it}
            selected={false}
            now={NOW}
            onPress={jest.fn()}
            status={statusFor(it, live(it, 'canceled'))}
          />,
        );
      });
      const top = r!.root.findAll((n) => n.props.testID === 'top-line' && typeof n.type === 'string')[0];
      const flat = Object.assign({}, ...[top.props.style].flat(3).filter(Boolean));
      expect(flat.flexWrap).toBe('nowrap');
      const right = top.findAll((n) => n.props.testID === 'top-right' && typeof n.type === 'string')[0];
      expect(Object.assign({}, ...[right.props.style].flat(3).filter(Boolean)).flexShrink).toBe(0);
      // A moved row's big times stay on one line and shrink to fit rather than wrap (John, 2026-11-02).
      await act(async () => {
        r!.update(
          <ResultRow
            itinerary={it}
            selected={false}
            now={NOW}
            onPress={jest.fn()}
            status={statusFor(it, live(it, 'delayed', 25))}
          />,
        );
      });
      const times = r!.root.findAll((n) => n.props.testID === 'row-times' && typeof n.type === 'string')[0];
      expect(times.props.numberOfLines).toBe(1);
      expect(times.props.adjustsFontSizeToFit).toBe(true);
      expect(r!.root.findAll((n) => n.props.testID === 'row-was' && typeof n.type === 'string')).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("route card: a leg's tag sits centered just above its route line (round 136, John)", async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(
        <ResultRow
          itinerary={it}
          selected
          now={NOW}
          onPress={jest.fn()}
          onLegPress={jest.fn()}
          status={statusFor(it, live(it, 'delayed', 25))}
        />,
      );
    });
    const box = r!.root.findAll((n) => n.props.testID === 'leg-box' && typeof n.type === 'string')[0];
    const words = (n: (typeof box)['children'][number] | typeof box) =>
      typeof n === 'string' ? [] : n.findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children as string);
    // The pill is in the middle between the airports, on top of the line, the length under it.
    const track = box.findAll((n) => n.props.testID === 'leg-track' && typeof n.type === 'string')[0];
    const order = track
      .findAll((n) => typeof n.type === 'string' && ['leg-tag', 'leg-length'].includes(n.props.testID))
      .map((n) => n.props.testID);
    expect(order).toEqual(['leg-tag', 'leg-length']);
    expect(words(track.findAll((n) => n.props.testID === 'leg-tag' && typeof n.type === 'string')[0])).toContain('Delayed 25m');
    // Not on the flight chip's row any more.
    const group = box.findAll((n) => n.props.testID === 'leg-flight' && typeof n.type === 'string')[0];
    expect(words(group)).not.toContain('Delayed 25m');
    // The chip shows American's mark and the code with the number again (round 136, John: "like DL, WN").
    expect(group.findAll((n) => n.props.testID === 'airline-mark' && typeof n.type === 'string').length).toBeGreaterThan(0);
    expect(words(group)).toContain('AA 1');
    expect(group.findAll((n) => n.props.accessibilityLabel === 'American 1' && typeof n.type === 'string').length).toBe(1);
  });

  it('route card: each leg box shows its aircraft type beside the flight chip (round 138, John)', async () => {
    const it = await fullItinerary();
    const withPlane = { ...it, legs: it.legs.map((l) => ({ ...l, flight: { ...l.flight, aircraft: 'Boeing 737-800' } })) };
    await act(async () => {
      r = create(<ResultRow itinerary={withPlane} selected now={NOW} onPress={jest.fn()} onLegPress={jest.fn()} />);
    });
    const group = r!.root.findAll((n) => n.props.testID === 'leg-flight' && typeof n.type === 'string')[0];
    const plane = group.findAll((n) => n.props.testID === 'leg-aircraft' && typeof n.type === 'string');
    expect(plane).toHaveLength(1);
    expect(plane[0].findAll((n) => n.props.children === '737-800').length).toBeGreaterThan(0);
    // No type known: nothing extra.
    act(() => r!.update(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} onLegPress={jest.fn()} />));
    expect(r!.root.findAll((n) => n.props.testID === 'leg-aircraft')).toHaveLength(0);
  });

  it('canceled: tag word and spoken text; departed: gray tag', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(
        <ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />,
      );
    });
    expect(strings(r!.root)).toContain('Canceled');
    expect(r!.root.findAll((n) => n.props.accessibilityRole === 'button')[0].props.accessibilityLabel).toContain(
      'Canceled, was 9:00 AM',
    );
    await act(async () => {
      r!.update(
        <ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'departed'))} />,
      );
    });
    expect(strings(r!.root)).toContain('Departed');
  });

  it('route card legs show both times: new ones when moved, a canceled leg keeps its schedule, struck (John, 2026-11-02)', async () => {
    const it = await twoLegItinerary();
    const struckTexts = () =>
      r!.root.findAll(
        (n) =>
          (n.type as unknown) === 'Text' &&
          [n.props.style]
            .flat(3)
            .some((st: { textDecorationLine?: string } | undefined) => st?.textDecorationLine === 'line-through'),
      );
    await act(async () => {
      r = create(
        <ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'delayed', 25))} />,
      );
    });
    // The schedule struck once above the top line, none on the leg.
    expect(struckTexts()).toHaveLength(1);
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const legWords = timeline.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(legWords).toContain('9:25\u00a0AM');
    // The leg's new arrival too, not only its new departure (10:00 AM at DEN, 25m late).
    expect(legWords).toContain('10:25\u00a0AM');
    expect(legWords).not.toContain('9:00\u00a0AM');
    await act(async () => {
      r!.update(
        <ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />,
      );
    });
    // The leg keeps its scheduled times, both ends struck; the top times go grey, not struck (on the
    // pass's navy stub, its own grey).
    const struck = struckTexts();
    expect(struck.map((n) => n.props.testID)).toEqual(['leg-clock', 'leg-arrive']);
    const top = r!.root.findAll((n) => n.props.testID === 'row-times-canceled' && typeof n.type === 'string')[0];
    expect(top.props.style).toEqual({ color: inkColors.light.muted });
    const after = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const words = after
      .findAll((n) => typeof n.type === 'string')
      .flatMap((n) => [n.props.children].flat().filter((x): x is string => typeof x === 'string'));
    expect(words).toContain('Canceled');
    expect(words).toContain('9:00\u00a0AM');
    expect(words).toContain('10:00\u00a0AM');
    expect(words).toContain('BNA');
    expect(words).toContain('DEN');
    // A canceled leg: its own pill says it; no "Unavailable" verdict up top (round 141, John's "just color
    // and seat numbers").
    expect(r!.root.findAll((n) => n.props.testID === 'seat-summary')).toHaveLength(0);
    const all = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(all).not.toContain('Unavailable');
  });

  it('a canceled second leg: flights on one line, one tag that names that flight (round 68, John)', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {},
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    const second = it.legs[1].flight;
    const canceled: FlightStatus = {
      flightNumber: 'WN20',
      state: 'canceled',
      departure: {
        airport: 'DEN',
        scheduledUtc: new Date(second.departUtc).toISOString(),
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      arrival: {
        airport: 'LAX',
        scheduledUtc: null,
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      providerUpdatedAt: null,
    };
    const status = rowStatus(
      it,
      { [flightLookupKey(legLookup(second))]: canceled },
      { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 },
    );
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={status} />);
    });
    const line = r!.root.findAll((n) => n.props.testID === 'flights-line' && typeof n.type === 'string')[0];
    expect(line.props.style).toMatchObject({ flexDirection: 'row' });
    // The flight pills carry no tags; the one tag names the canceled flight.
    const items = line.findAll((n) => n.props.testID === 'flight-item' && typeof n.type === 'string');
    const words = items.map((n) => n.findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children as string));
    expect(words.flat().some((w) => /cancel/i.test(w))).toBe(false);
    const tags = line.findAll((n) => n.props.testID === 'row-tag' && typeof n.type === 'string');
    expect(tags).toHaveLength(1);
    expect(tags[0].findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children)).toContain(
      'DEN → LAX canceled',
    );
  });

  it('a diverted leg keeps its time, names where it went and says it continues (John, 2026-11-01)', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {
        A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }],
        B: [{ source: 'reported', openSeats: 20, listed: 4, asOf: NOW }],
      },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    const first = it.legs[0].flight;
    const diverted: FlightStatus = {
      flightNumber: 'WN10',
      state: 'diverted',
      departure: {
        airport: 'BNA',
        scheduledUtc: new Date(first.departUtc).toISOString(),
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      arrival: {
        airport: 'COS',
        scheduledUtc: null,
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      providerUpdatedAt: null,
    };
    const status = rowStatus(
      it,
      { [flightLookupKey(legLookup(first))]: diverted },
      { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 },
    );
    expect(status.canceled).toBe(false);
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} status={status} />);
    });
    const strings = (n: ReactTestInstance) =>
      n.findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children as string);
    const notes = r!.root.findAll((n) => n.props.testID === 'leg-diverted-note' && typeof n.type === 'string');
    expect(notes).toHaveLength(1);
    expect(strings(notes[0]).join('')).toBe('Continuing to DEN');
    // Its arrival slot reads TBD, in the same place as every other leg's arrival (John, 2026-11-02).
    const arrives = r!.root.findAll((n) => n.props.testID === 'leg-arrive' && typeof n.type === 'string');
    expect(arrives.map((n) => [n.props.children].flat().join(''))).toContain('TBD');
    const all = strings(r!.root);
    expect(all).toContain('Diverted to COS');
    // No strike through for a diversion: only a canceled flight's time is crossed out.
    const struck = r!.root.findAll(
      (n) => typeof n.type === 'string' && JSON.stringify(n.props.style ?? '').includes('line-through'),
    );
    expect(struck).toHaveLength(0);
  });

  it('each leg dot holds its open/listed seats (John, 2026-11-02)', async () => {
    const base = { tier: 'good' as const, asOf: NOW };
    expect(dotSeats({ ...base, source: 'reported', netSeats: 7, openSeats: 10, listed: 3 })).toBe('10/3');
    expect(dotSeats({ ...base, source: 'estimate', netSeats: -15, openSeats: 5, listed: 20 })).toBe('5/20');
    expect(dotSeats({ ...base, source: 'estimate', netSeats: 12 })).toBe('12');
    expect(dotSeats({ ...base, tier: 'unknown', source: 'typical', netSeats: 20 })).toBe('20');
    expect(dotSeats({ tier: 'unknown', source: 'unknown', netSeats: null, asOf: null })).toBe('–');

    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    const dots = r!.root.findAll((n) => n.props.testID === 'leg-dot-seats' && typeof n.type === 'string');
    expect(dots.map((d) => d.props.children)).toEqual(['4/9']);
  });

  it("every leg's status pill sits over its own route line, so they line up top to bottom (round 136, John)", async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {
        A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }],
        B: [{ source: 'reported', openSeats: 20, listed: 4, asOf: NOW }],
      },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    const point = (airport: string, iso: string | null) => ({
      airport,
      scheduledUtc: iso,
      estimatedUtc: null,
      actualUtc: null,
      delayMin: null,
      terminal: null,
      gate: null,
    });
    const diverted = (f: (typeof it.legs)[number]['flight'], to: string): FlightStatus => ({
      flightNumber: `WN${f.flightNumber}`,
      state: 'diverted',
      departure: point(f.from, new Date(f.departUtc).toISOString()),
      arrival: point(to, null),
      providerUpdatedAt: null,
    });
    const [a, b] = it.legs.map((l) => l.flight);
    const status = rowStatus(
      it,
      { [flightLookupKey(legLookup(a))]: diverted(a, 'COS'), [flightLookupKey(legLookup(b))]: diverted(b, 'ONT') },
      { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 },
    );
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} status={status} />);
    });
    const tags = r!.root.findAll((n) => n.props.testID === 'leg-tag' && typeof n.type === 'string');
    expect(tags).toHaveLength(2);
    // Each inside its leg's route line, centered between the two airports.
    const tracks = r!.root.findAll((n) => n.props.testID === 'leg-track' && typeof n.type === 'string');
    for (const t of tracks) expect(t.findAll((n) => n.props.testID === 'leg-tag' && typeof n.type === 'string')).toHaveLength(1);
    expect(r!.root.findAll((n) => n.props.testID === 'leg-chip-col')).toHaveLength(0);
  });

  it('route card: no banner for a canceled leg; its own pill says it and the seat chip stays up top (John, 2026-11-02)', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      {
        A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }],
        B: [{ source: 'reported', openSeats: 20, listed: 4, asOf: NOW }],
      },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    const second = it.legs[1].flight;
    const canceled: FlightStatus = {
      flightNumber: 'WN20',
      state: 'canceled',
      departure: {
        airport: 'DEN',
        scheduledUtc: new Date(second.departUtc).toISOString(),
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      arrival: {
        airport: 'LAX',
        scheduledUtc: null,
        estimatedUtc: null,
        actualUtc: null,
        delayMin: null,
        terminal: null,
        gate: null,
      },
      providerUpdatedAt: null,
    };
    const status = rowStatus(
      it,
      { [flightLookupKey(legLookup(second))]: canceled },
      { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 },
    );
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={status} />);
    });
    const stub = r!.root.findAll((n) => n.props.testID === 'ticket-stub' && typeof n.type === 'string')[0];
    const head = stub.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(head).not.toContain('DEN → LAX canceled');
    expect(head).not.toContain('Unavailable');
    expect(r!.root.findAll((n) => n.props.testID === 'headline')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'seat-summary')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'seat-age')).toHaveLength(0);
    // The canceled leg keeps its one tag on its own line; no seat text per leg.
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const words = timeline.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(words).toContain('Canceled');
    expect(words.some((w) => /open|listed|reported/.test(w))).toBe(false);
  });
});

describe('connectionText (John, 2026-11-02)', () => {
  it('gives the live minutes, or says the connection is missed', () => {
    expect(connectionText({ airport: 'DEN', sameAirline: true }, 125)).toBe('2h 5m connection at DEN');
    expect(connectionText({ airport: 'DEN', sameAirline: false }, 35)).toBe('35m connection at DEN, change airlines');
    expect(connectionText({ airport: 'DEN', sameAirline: false }, 35, 'UA')).toBe('35m connection at DEN, change airlines to UA');
    expect(connectionText({ airport: 'DEN', sameAirline: true }, -10)).toBe('Misses the connection at DEN');
  });
});

describe('ResultRow at big text sizes (design round 26)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('puts the stops and trip length under the times, left-aligned, instead of squeezing them (round 141)', async () => {
    // Jest's default font scale is 2, which is past STACK_TOP_LINE_SCALE.
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    const stops = r!.root.findAll((n) => n.props.testID === 'row-stops' && typeof n.type === 'string')[0];
    const flat = (style: unknown) => Object.assign({}, ...([style] as unknown[]).flat(3).filter(Boolean));
    expect(flat(stops.props.style)).toMatchObject({ alignItems: 'flex-start', maxWidth: '100%' });
    const holder = r!.root.findAll((n) => n.props.testID === 'top-right' && typeof n.type === 'string')[0];
    expect(flat(holder.props.style)).toMatchObject({ flexBasis: '100%', justifyContent: 'flex-start' });
  });
});

describe('Route card as a boarding pass (round 114)', () => {
  it('puts the chip, Save and times on a navy stub, tears, then the flights on white', async () => {
    const it = await twoLegItinerary();
    let r: ReactTestRenderer;
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} topAction={<></>} />);
    });
    const host = (id: string) => r!.root.findAll((n) => n.props.testID === id && typeof n.type === 'string')[0];
    const stub = host('ticket-stub');
    expect(stub.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: colors.light.ink })]));
    // The times on the stub are white; the flights below it are not on the stub.
    expect(stub.findAll((n) => n.props.testID === 'row-times').length).toBeGreaterThan(0);
    expect(stub.findAll((n) => n.props.testID === 'leg-timeline')).toHaveLength(0);
    // A subtle boarding pass tear sits between the header and the flights (round 121).
    expect(r!.root.findAll((n) => n.props.testID === 'ticket-tear' && typeof n.type !== 'string')).toHaveLength(1);
    await act(async () => {
      r!.update(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    // In the list, the picked row has no stub; its one tear sits between the times and the flights.
    expect(r!.root.findAll((n) => n.props.testID === 'ticket-stub')).toHaveLength(0);
    expect(r!.root.findAll((n) => n.props.testID === 'ticket-tear' && typeof n.type === 'string')).toHaveLength(1);
    r!.unmount();
  });
});

describe('measurePerfOn: the tear finds the dashes inside the card itself (round 136, John)', () => {
  type Cb = (x: number, y: number, w: number, h: number) => void;
  const view = (win: [number, number, number, number], inCard?: [number, number, number, number]) => ({
    measureInWindow: (cb: Cb) => cb(...win),
    measureLayout: (_to: unknown, ok: Cb, fail?: () => void) => (inCard ? ok(...inCard) : fail?.()),
  });
  it('puts the dashes where they sit in the card, on top of where the card is on screen', () => {
    const done = jest.fn();
    // On screen the strip reports a stale place; inside the card it is 120 points down.
    measurePerfOn(view([0, 999, 358, 14], [0, 120, 358, 14]), view([16, 200, 358, 400]), done);
    expect(done).toHaveBeenCalledWith(16, 320, 358, 14);
  });
  it("falls back to the screen place, or nothing, when it can't", () => {
    const done = jest.fn();
    measurePerfOn(view([0, 310, 358, 14]), view([16, 200, 358, 400]), done);
    expect(done).toHaveBeenLastCalledWith(0, 310, 358, 14);
    measurePerfOn(null, null, done);
    expect(done).toHaveBeenLastCalledWith(0, 0, 0, 0);
  });
});
