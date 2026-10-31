import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createMemoryProvider, searchItineraries, zonedToUtc } from '@/engine';
import { flightLookupKey, type FlightStatus } from '@/live';
import { legLookup, rowStatus } from '@/search/statusTags';
import { colors } from '@/theme';

import { ResultRow } from '../ResultRow';

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

  it('renders tier word, badge slot and a single accessible label; full routes say Full', async () => {
    const it = await fullItinerary();
    const onPress = jest.fn();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={onPress} />);
    });
    const root = r!.root;
    const button = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(button.props.accessibilityLabel).toContain('Full route');
    expect(button.props.accessibilityState).toEqual({ selected: false });
    expect(root.findAll((n) => n.props.testID === 'badge-slot').length).toBeGreaterThan(0);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    // Seats lead the top line (Q-059) with their age; the slim row has no per-leg seat chips (Q-062).
    // Just the chance word on the row; the numbers are in the flight's sheet (John, 2026-10-31).
    expect(texts).toContain('Full');
    expect(texts.some((t) => / open · \d+ listed/.test(String(t)))).toBe(false);
    expect(root.findAll((n) => n.props.testID === 'seat-age' && typeof n.type === 'string')[0].props.children).toBe('Reported just now');
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
        .map((n) => [n.props.children].flat().filter((x: unknown) => typeof x === 'string').join(''));
      expect(all.some((t) => t.startsWith('BNA →') || t.includes('BNA\u00a0→'))).toBe(true);
    }
  });

  it('shows the delay badge and exposes details as a VoiceOver action', async () => {
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
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impact={impact} onImpactPress={onImpact} />);
    });
    const root = r!.root;
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Likely delays at LAX: Ground stop');
    expect(row.props.accessibilityActions).toEqual([{ name: 'impact', label: 'Delay and weather details' }]);
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'impact' } }));
    expect(onImpact).toHaveBeenCalledWith(it.id);
    const texts = root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    // The badge is just the word; the airport and age are in the sheet (Q-072, John: C).
    expect(texts).toContain('Likely delays');
    expect(texts.some((t) => / ago$/.test(String(t)) && String(t).startsWith('Likely'))).toBe(false);
    const pill = root.findAll((n) => n.props.hitSlop != null)[0];
    expect(pill.props.hitSlop).toEqual({ top: 11, bottom: 11, left: 10, right: 10 });
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

  it('connections: the headline is the weakest leg\'s chance word; legs are one line each (round 66)', async () => {
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
    const all = r!.root.findAll((n) => typeof n.type === 'string' && n.props.children != null).map((n) => [n.props.children].flat().join(''));
    expect(all).toContain('1h 30m at DEN');
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

  it('shows Checking… while live data loads', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} impactLoading />);
    });
    const texts = r!.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Checking…');
  });

  const live = (it: Awaited<ReturnType<typeof fullItinerary>>, state: FlightStatus['state'], lateMin = 0): FlightStatus => {
    const f = it.legs[0].flight;
    const d = new Date(f.departUtc).toISOString();
    return {
      flightNumber: 'AA1',
      state,
      departure: { airport: 'BNA', scheduledUtc: d, estimatedUtc: lateMin ? new Date(f.departUtc + lateMin * 60_000).toISOString() : null, actualUtc: null, delayMin: lateMin || null, terminal: null, gate: null },
      arrival: { airport: 'LAX', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      providerUpdatedAt: null,
    };
  };
  const statusFor = (it: Awaited<ReturnType<typeof fullItinerary>>, s: FlightStatus) =>
    rowStatus(it, { [flightLookupKey(legLookup(it.legs[0].flight))]: s }, { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 });
  const strings = (root: ReactTestRenderer['root']) =>
    root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

  it('delayed: violet tag, old time struck through, new time, spoken in the row label', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'delayed', 25))} />);
    });
    const root = r!.root;
    expect(strings(root)).toContain('Delayed 25m');
    const struck = root.findAll((n) => (n.type as unknown) === 'Text' && [n.props.style].flat(3).some((st: { textDecorationLine?: string } | undefined) => st?.textDecorationLine === 'line-through'));
    // In the top time line only (not again on the leg line): the old departure, and the old
    // arrival, since a 25-minute late departure lands about 25 minutes late (design round 25).
    expect(struck).toHaveLength(2);
    const times = root.findAll((n) => n.props.testID === 'row-times' && typeof n.type === 'string')[0];
    const flat = (n: unknown): string =>
      typeof n === 'string' ? n : Array.isArray(n) ? n.map(flat).join('') : n && typeof n === 'object' && 'props' in n ? flat((n as { props: { children?: unknown } }).props.children) : '';
    // Each time keeps its number and AM/PM together (non-breaking space, design round 26).
    // The old time small and struck on the left, then the new time (John, 2026-10-30, round 58).
    expect(flat(times.props.children)).toBe('9:00\u00a0AM\u00a09:25\u00a0AM – 11:20\u00a0AM\u00a011:45\u00a0AM');
    // The flights stay on one line with one tag after them (John, 2026-10-31).
    const line = root.findAll((n) => n.props.testID === 'flights-line' && typeof n.type === 'string')[0];
    expect(line.props.style).toMatchObject({ flexDirection: 'row' });
    expect(line.findAll((n) => n.props.testID === 'row-tag' && typeof n.type === 'string')).toHaveLength(1);
    const row = root.findAll((n) => n.props.accessibilityRole === 'button')[0];
    expect(row.props.accessibilityLabel).toContain('Delayed 25 minutes, was 9:00 AM, now 9:25 AM');
    // The weather/FAA badge slot stays separate from status tags.
    expect(root.findAll((n) => n.props.testID === 'badge-slot')[0].findAll((n) => n.props.children === 'Delayed 25m')).toHaveLength(0);
  });

  it('canceled: tag word and spoken text; departed: gray tag', async () => {
    const it = await fullItinerary();
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />);
    });
    expect(strings(r!.root)).toContain('Canceled');
    expect(r!.root.findAll((n) => n.props.accessibilityRole === 'button')[0].props.accessibilityLabel).toContain('Canceled, was 9:00 AM');
    await act(async () => {
      r!.update(<ResultRow itinerary={it} selected={false} now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'departed'))} />);
    });
    expect(strings(r!.root)).toContain('Departed');
  });

  it('route card: the struck original shows only in the top line; legs show the new time or nothing (round 59)', async () => {
    const it = await fullItinerary();
    const struckTexts = () =>
      r!.root.findAll((n) => (n.type as unknown) === 'Text' && [n.props.style].flat(3).some((st: { textDecorationLine?: string } | undefined) => st?.textDecorationLine === 'line-through'));
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'delayed', 25))} />);
    });
    // Old departure and old arrival in the top line, none on the leg.
    expect(struckTexts()).toHaveLength(2);
    const timeline = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const legWords = timeline.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(legWords).toContain('9:25\u00a0AM');
    expect(legWords).not.toContain('9:00\u00a0AM');
    await act(async () => {
      r!.update(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={statusFor(it, live(it, 'canceled'))} />);
    });
    // Only the top line is struck; the leg says Canceled with no time.
    expect(struckTexts()).toHaveLength(1);
    const after = r!.root.findAll((n) => n.props.testID === 'leg-timeline' && typeof n.type === 'string')[0];
    const words = after.findAll((n) => typeof n.type === 'string').flatMap((n) => [n.props.children].flat().filter((x): x is string => typeof x === 'string'));
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
      departure: { airport: 'DEN', scheduledUtc: new Date(second.departUtc).toISOString(), estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      arrival: { airport: 'LAX', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      providerUpdatedAt: null,
    };
    const status = rowStatus(it, { [flightLookupKey(legLookup(second))]: canceled }, { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 });
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
    expect(tags[0].findAll((x) => typeof x.props.children === 'string').map((x) => x.props.children)).toContain('DEN → LAX canceled');
  });

  it('route card A: a canceled leg is the headline; the seats step down to the bottom line (round 66)', async () => {
    const at = (hhmm: string) => zonedToUtc('2026-10-20', hhmm, 'America/Chicago');
    const provider = createMemoryProvider(
      [
        { id: 'A', airline: 'WN', flightNumber: '10', from: 'BNA', to: 'DEN', departUtc: at('08:00'), arriveUtc: at('10:00') },
        { id: 'B', airline: 'WN', flightNumber: '20', from: 'DEN', to: 'LAX', departUtc: at('11:30'), arriveUtc: at('13:30') },
      ],
      { A: [{ source: 'reported', openSeats: 30, listed: 5, asOf: NOW }], B: [{ source: 'reported', openSeats: 20, listed: 4, asOf: NOW }] },
    );
    const [it] = await searchItineraries(provider, { origin: 'BNA', destination: 'LAX', date: '2026-10-20' }, { now: NOW });
    const second = it.legs[1].flight;
    const canceled: FlightStatus = {
      flightNumber: 'WN20',
      state: 'canceled',
      departure: { airport: 'DEN', scheduledUtc: new Date(second.departUtc).toISOString(), estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      arrival: { airport: 'LAX', scheduledUtc: null, estimatedUtc: null, actualUtc: null, delayMin: null, terminal: null, gate: null },
      providerUpdatedAt: null,
    };
    const status = rowStatus(it, { [flightLookupKey(legLookup(second))]: canceled }, { minConnectSameAirlineMin: 60, minConnectSwitchMin: 90 });
    await act(async () => {
      r = create(<ResultRow itinerary={it} selected large now={NOW} onPress={jest.fn()} status={status} />);
    });
    const row = r!.root.findAll((n) => n.props.testID === 'headline-row' && typeof n.type === 'string')[0];
    const head = row.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(head).toContain('DEN → LAX canceled');
    expect(row.findAll((n) => n.props.testID === 'seat-summary').length).toBe(0);
    const age = r!.root.findAll((n) => n.props.testID === 'seat-age' && typeof n.type === 'string')[0];
    expect(age.props.children).toBe(`Seats: ${it.tier === 'wide' ? 'Easy' : 'Likely'} · reported just now`);
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
