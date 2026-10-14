import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useRadarLayers } from '../useRadarLayers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockConfig = { current: { baseUrl: 'https://x.supabase.co', anonKey: 'anon' } as object | null };
jest.mock('@/live', () => ({
  readLiveConfig: () => mockConfig.current,
  // Radar off (no regions) reports 'off', like the real hook.
  useRadar: (regions: readonly string[]) => ({ frames: [], attribution: '', state: regions.length ? 'loading' : 'off' }),
}));

describe('useRadarLayers', () => {
  let r: ReactTestRenderer | undefined;
  afterEach(() => act(() => r?.unmount()));

  function render(on: boolean) {
    let out!: ReturnType<typeof useRadarLayers>;
    function C() {
      out = useRadarLayers(on, Date.UTC(2026, 9, 14, 8));
      return null;
    }
    act(() => {
      r = create(<C />);
    });
    return out;
  }

  it('keeps the map button available when radar is turned off (so it can be turned back on)', () => {
    const off = render(false);
    expect(off.available).toBe(true);
    expect(off.layers).toEqual([]);
    expect(off.caption).toBeNull();
  });

  it('shows loading while on', () => {
    expect(render(true).caption).toBe('Radar loading…');
  });

  it('hides the button only when the live service is not set up', () => {
    mockConfig.current = null;
    expect(render(true).available).toBe(false);
    mockConfig.current = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
  });
});
