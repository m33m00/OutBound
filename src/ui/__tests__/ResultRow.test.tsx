import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { flightLookupKey, type FlightStatus } from '@/live';
import { legLookup, rowStatus } from '@/search/statusTags';
import { colors } from '@/theme';

import { dotSeats, ResultRow, tagColumnWidth } from '../ResultRow';
import { StatusTag } from '../StatusTag';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 19, 12);

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

  it('renders tier word and a single accessible label; full routes say Full', async () => {
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
    // Seats lead the top line (Q-059) with their age; the slim row has no per-leg seat chips (Q-062).
    // Just the chance word on the row; the numbers are in the flight's sheet (John, 2026-10-31).
    expect(texts).toContain('Full');
    expect(texts.some((t) => / open · \d+ listed/.test(String(t)))).toBe(false);
    expect(root.findAll((n) => n.props.testID === 'seat-age' && typeof n.type === 'string')[0].props.children).toBe(
      'Reported just now',
    );
    expect(root.findAll((n) => n.props.testID === 'flights-line' && typeof n.type === 'string').length).toBe(1);
    expect(root.findAll((n) => n.props.testID === 'seat-summary').length).toBeGreaterThan(0);
    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledWith(it.id);
  });

  it('opens into route card A when selected: chance word up top, one seat age at the bottom (round 66)', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Seats reported just now');
    expect(texts.filter((t) => /reported/i.test(String(t))).length).toBe(2); // the host and the native text: one line
    const headlineRow = r!.root.findAll((n) => n.props.testID === 'headline-row' && typeof n.type === 'string')[0];
    expect(headlineRow.findAll((n) => n.props.testID === 'seat-summary').length).toBeGreaterThan(0);
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
      expect(texts.some((t) => t.includes('min from') || t.startsWith('Leaves from'))).toBe(false);
      // The route still names the airport it leaves from: the route line, or each flight's line on the card.
      const all = r!.root
        .findAll((n) => typeof n.type === 'string' && n.props.children != null)
        .map((n) =>
          [n.props.children]
            .flat()
            .filter((x: unknown) => typeof x === 'string')
            .join(''),
        );
      expect(all.some((t) => t.startsWith('BNA →') || t.includes('BNA\u00a0→'))).toBe(true);
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
    expect(texts).toContain('Nonstop');
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
    const summary = r!.root.findAll((n) => n.props.testID === 'seat-summary' && typeof n.type === 'string')[0];
    const words = summary.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(words[0]).toBe('Long\u00a0shot');
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    // One age for the card, none per leg.
    expect(texts.filter((t) => t.includes('reported just now'))).toEqual(['Seats reported just now', 'Seats reported just now']);
    // The route card names the connection between the legs.
    const all = r!.root
      .findAll((n) => typeof n.type === 'string' && n.props.children != null)
      .map((n) => [n.props.children].flat().join(''));
    expect(all).toContain('1h 30m connection at DEN');
    // Stops read as a timeline (round 56): one dot per leg in its seat color, no second seat chip.
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string');
    expect(timeline.length).toBe(1);
    expect(timeline[0].findAll((n) => n.props.testID === 'leg-dot' && typeof n.type === 'string').length).toBe(2);
    const chips = r!.root.findAll((n) => n.props.testID === 'seat-summary' && typeof n.type === 'string');
    expect(chips.length).toBe(1);
    // Each leg line leads with its own departure time.
    expect(all).toContain('8:00\u00a0AM');
    expect(all.some((t) => t.endsWith('  BNA\u00a0→\u00a0DEN'))).toBe(true);
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
        .findAll(
          (n) => typeof n.type === 'string' && (n.props.testID === 'leg-flight' || /→/.test([n.props.children].flat().join(''))),
        )
        .map((n) => (n.props.testID === 'leg-flight' ? 'flight' : 'time'))
        .filter((t, i, a) => a.indexOf(t) === i);
    expect(inBox(boxes[0])).toEqual(['flight', 'time']);
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

  it('grays the seat summary on a route that already left, keeping its words', async () => {
    const it = await fullItinerary();
    const status = { legs: [], risks: [], dimmed: true, canceled: false, spoken: ['Departed'] };
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={status} />);
    });
    const summary = r!.root.findAll((n) => n.props.testID === 'seat-summary' && typeof n.type === 'string')[0];
    const text = summary.findAll((n) => typeof n.props.children === 'string')[0];
    const flat = (style: unknown) => Object.assign({}, ...([style] as unknown[]).flat(3).filter(Boolean));
    expect(flat(text.props.style).color).toBe(colors.light.muted);
    expect(text.props.children).toBe('Full');
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
      // The leg's new time carries the same tint.
      expect(colorOf('leg-clock')).toBe(colors.light[token]);
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

  it("route card: a leg's tag sits just left of its flight, in one piece (John, 2026-11-01)", async () => {
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
    const group = r!.root.findAll((n) => n.props.testID === 'leg-flight' && typeof n.type === 'string')[0];
    const words = group.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    const tagAt = words.indexOf('Delayed 25m');
    expect(tagAt).toBeGreaterThanOrEqual(0);
    // The flight chip's text comes after the tag, inside the same group.
    const flat = group
      .findAll((n) => typeof n.type === 'string' && n.props.children != null)
      .map((n) => [n.props.children].flat().join(''));
    const flightAt = flat.findIndex((t) => /AA\s?1/.test(t));
    expect(flightAt).toBeGreaterThan(flat.indexOf('Delayed 25m'));
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

  it('route card: the struck original shows only in the top line; legs show the new time or nothing (round 59)', async () => {
    const it = await fullItinerary();
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
    expect(legWords).not.toContain('9:00\u00a0AM');
    await act(async () => {
      r!.update(
        <ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />,
      );
    });
    // Only the top line is struck; the leg says Canceled with no time.
    expect(struckTexts()).toHaveLength(1);
    const after = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const words = after
      .findAll((n) => typeof n.type === 'string')
      .flatMap((n) => [n.props.children].flat().filter((x): x is string => typeof x === 'string'));
    expect(words).toContain('Canceled');
    // No time before the airports (no leading gap either).
    expect(words).toContain('BNA\u00a0→\u00a0LAX');
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
    expect(strings(notes[0]).join('')).toBe('Continuing to DEN \u00b7 new arrival time pending');
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
    expect(dotSeats({ ...base, tier: 'unknown', source: 'typical', netSeats: 20 })).toBe('~20');
    expect(dotSeats({ tier: 'unknown', source: 'unknown', netSeats: null, asOf: null })).toBe('–');

    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected now={NOW} onPress={jest.fn()} />);
    });
    const dots = r!.root.findAll((n) => n.props.testID === 'leg-dot-seats' && typeof n.type === 'string');
    expect(dots.map((d) => d.props.children)).toEqual(['4/9']);
  });

  it('status tags widen to the widest so the flight chips line up (John, 2026-11-02)', async () => {
    expect(tagColumnWidth({}, 2)).toBeUndefined();
    expect(tagColumnWidth({ 0: 80 }, 2)).toBeUndefined(); // waits for every tagged leg
    expect(tagColumnWidth({ 0: 80 }, 1)).toBeUndefined(); // one tag has nothing to line up with
    expect(tagColumnWidth({ 0: 80, 1: 109.4 }, 2)).toBe(110);

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
    const tags = () =>
      r!.root.findAll((n) => n.props.testID === 'leg-flight' && typeof n.type === 'string').map((g) => g.findByType(StatusTag));
    expect(tags()).toHaveLength(2);
    expect(tags().map((t) => t.props.minWidth)).toEqual([undefined, undefined]);
    const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 22 } } });
    await act(async () => {
      tags()[0].props.onLayout(layout(80));
      tags()[1].props.onLayout(layout(104));
    });
    expect(tags().map((t) => t.props.minWidth)).toEqual([104, 104]);
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
    const row = r!.root.findAll((n) => n.props.testID === 'headline-row' && typeof n.type === 'string')[0];
    const head = row.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(head).not.toContain('DEN → LAX canceled');
    expect(r!.root.findAll((n) => n.props.testID === 'headline')).toHaveLength(0);
    expect(row.findAll((n) => n.props.testID === 'seat-summary').length).toBeGreaterThan(0);
    const age = r!.root.findAll((n) => n.props.testID === 'seat-age' && typeof n.type === 'string')[0];
    expect(age.props.children).toBe('Seats reported just now');
    // The canceled leg keeps its one tag on its own line; no seat text per leg.
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const words = timeline.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(words).toContain('Canceled');
    expect(words.some((w) => /open|listed|reported/.test(w))).toBe(false);
  });
});

describe('ResultRow at big text sizes (design round 26)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('puts the seat chip under the times, left-aligned, and lets it wrap instead of clipping', async () => {
    // Jest's default font scale is 2, which is past STACK_TOP_LINE_SCALE.
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} />);
    });
    const chip = r!.root.findAll((n) => n.props.testID === 'seat-summary' && typeof n.type === 'string')[0];
    const flat = (style: unknown) => Object.assign({}, ...([style] as unknown[]).flat(3).filter(Boolean));
    expect(flat(chip.props.style)).toMatchObject({ flexShrink: 1, maxWidth: '100%' });
    const holder = r!.root.findAll((n) => n.props.testID === 'top-right' && typeof n.type === 'string')[0];
    expect(flat(holder.props.style)).toMatchObject({ flexBasis: '100%', justifyContent: 'flex-start' });
  });
});
