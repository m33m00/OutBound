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
        <ImpactSheet visible title="Delays and weather" subtitle="DAL → DFW → LAX" impact={impact} now={NOW} sample={false} onClose={jest.fn()} />,
      );
    });
    const labels = r!.root.findAll((n) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(labels).toContain('DFW, connection, likely delays. Low ceilings, from FAA. Updated 4 minutes ago, may be out of date');
    expect(labels).toContain('DAL to DFW to LAX');
  });
});
