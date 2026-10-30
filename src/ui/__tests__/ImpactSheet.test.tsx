import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import type { RouteImpact } from '@/live';

import { ImpactSheet } from '../ImpactSheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 30, 15);
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const impact: RouteImpact = {
  level: 'likelyDelays',
  asOf: iso(4),
  stale: true,
  stations: [
    {
      code: 'DFW',
      role: 'connection',
      level: 'likelyDelays',
      reasons: [{ source: 'FAA', text: 'Low ceilings', level: 'likelyDelays' }],
      asOf: iso(4),
      stale: true,
      noForecast: false,
    },
  ],
};

describe('ImpactSheet VoiceOver (design round 26)', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  it('reads each station in words and the route as "to"', () => {
    act(() => {
      r = create(
        <ImpactSheet visible title="Delays and weather" subtitle="DAL → DFW → LAX" impact={impact} now={NOW} onClose={jest.fn()} />,
      );
    });
    const labels = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(labels).toContain('DFW, connection, likely delays. Low ceilings, from FAA. Updated 4 minutes ago, may be out of date');
    expect(labels).toContain('DAL to DFW to LAX');
  });

  it('puts the worst airport first and says when there is no data (round 41)', () => {
    const clear = { ...impact.stations[0], code: 'LAX', role: 'destination' as const, level: 'none' as const, reasons: [], asOf: null, stale: false };
    const route: RouteImpact = { ...impact, stations: [clear, impact.stations[0]] };
    act(() => {
      r = create(<ImpactSheet visible title="Delays and weather" impact={route} now={NOW} onClose={jest.fn()} />);
    });
    const labels = r!.root
      .findAll((n) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string' && /^(DFW|LAX),/.test(n.props.accessibilityLabel))
      .map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/^DFW/);
    expect(labels[1]).toMatch(/^LAX, destination, no data yet/);
  });

  it('shows a line instead of a blank sheet with no stations', () => {
    act(() => {
      r = create(<ImpactSheet visible title="Delays and weather" impact={null} now={NOW} onClose={jest.fn()} />);
    });
    const texts = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('No delay or weather data for this route yet.');
  });

  it('says what was checked when there is no forecast (round 41 review)', () => {
    const base = { ...impact.stations[0], level: 'none' as const, reasons: [], stale: false, noForecast: true };
    const route: RouteImpact = { ...impact, stations: [{ ...base, code: 'PHX' }, { ...base, code: 'LAX', role: 'destination', asOf: null }] };
    act(() => {
      r = create(<ImpactSheet visible title="Delays and weather" impact={route} now={NOW} onClose={jest.fn()} />);
    });
    const texts = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(['No FAA delays', 'No weather forecast']));
    // The forecast line shows once, under the airport whose word doesn't already say it.
    expect(texts.filter((t) => t === 'No weather forecast for this airport.')).toHaveLength(1);
    expect(texts).not.toContain('No known disruption');
  });
});

