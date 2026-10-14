import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useRadar, type UseRadarResult } from '../useRadar';
import {
  buildRadarRequestUrl,
  clampRefreshMs,
  fetchRadar,
  framesFromResponse,
  nextRefreshDelay,
  radarImageSource,
} from '../radar';
import type { Fetcher } from '../airportStatus';
import type { LiveRadarResponse } from '../radar';
import { CONUS_LATEST_ISO, CONUS_LATEST_MS } from '../fixtures/radar-samples';
import { RADAR_CONFIG as C } from '../../../supabase/functions/_shared/radarConfig';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const body: LiveRadarResponse = {
  attribution: 'Radar: NOAA/NWS MRMS',
  regions: [
    {
      region: 'conus',
      observedAt: CONUS_LATEST_ISO,
      bbox: [-130, 20, -60, 55],
      width: 1536,
      height: 768,
      imageUrl: '?image=conus&t=2026-10-14T07%3A16%3A16Z',
      stale: false,
      available: true,
    },
    { region: 'hi', observedAt: null, bbox: [-164, 15, -151, 26], width: 1024, height: 866, imageUrl: null, stale: true, available: false },
  ],
};
const okFetcher = (): jest.MockedFunction<Fetcher> =>
  jest.fn(async (_u: string, _i?: { headers?: Record<string, string> }) => ({ ok: true, status: 200, json: async () => body }));
const now = () => CONUS_LATEST_MS + 60_000;

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  while (mounted.length) await act(async () => mounted.pop()!.unmount());
});

async function render(regions: string[], opts: Parameters<typeof useRadar>[1]) {
  let latest!: UseRadarResult;
  function C() {
    latest = useRadar(regions, opts);
    return null;
  }
  await act(async () => {
    mounted.push(create(<C />));
  });
  return () => latest;
}

describe('radar client helpers', () => {
  it('builds the request URL (sorted, deduped, unknown dropped) and image source with auth headers', () => {
    expect(buildRadarRequestUrl(['hi', 'conus', 'hi', 'guam'], config)).toBe(
      'https://x.supabase.co/functions/v1/live-radar?regions=conus,hi',
    );
    expect(radarImageSource(config, body.regions[0].imageUrl!)).toEqual({
      uri: 'https://x.supabase.co/functions/v1/live-radar?image=conus&t=2026-10-14T07%3A16%3A16Z',
      headers: { apikey: 'anon', Authorization: 'Bearer anon' },
    });
  });

  it('maps frames, dropping regions with no picture', () => {
    const frames = framesFromResponse(body, config, now());
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ region: 'conus', observedAt: CONUS_LATEST_ISO, stale: false, available: true });
    expect(frames[0].image.headers.apikey).toBe('anon');
  });

  it('re-checks age on the client: an old response is stale, then unavailable', () => {
    expect(framesFromResponse(body, config, CONUS_LATEST_MS + C.staleAfterMs + 1)[0]).toMatchObject({ stale: true, available: true });
    expect(framesFromResponse(body, config, CONUS_LATEST_MS + C.maxAgeMs + 1)[0].available).toBe(false);
  });

  it('clamps the refresh interval and backs off per failure', () => {
    expect(clampRefreshMs(undefined)).toBe(C.clientRefresh.defaultMs);
    expect(clampRefreshMs(1)).toBe(C.clientRefresh.minMs);
    expect(clampRefreshMs(1e12)).toBe(C.clientRefresh.maxMs);
    expect(clampRefreshMs(0)).toBeNull();
    expect(clampRefreshMs(NaN)).toBeNull();
    expect(nextRefreshDelay(60_000, 0)).toBe(60_000);
    expect(nextRefreshDelay(60_000, 2)).toBe(240_000);
    expect(nextRefreshDelay(60_000, 20)).toBe(C.clientRefresh.maxMs);
  });

  it('fetchRadar sends auth headers and throws on non-OK', async () => {
    const f = okFetcher();
    await fetchRadar(['conus'], config, f);
    expect(f.mock.calls[0][1]?.headers).toEqual({ apikey: 'anon', Authorization: 'Bearer anon' });
    const bad: Fetcher = async () => ({ ok: false, status: 502, json: async () => ({}) });
    await expect(fetchRadar(['conus'], config, bad)).rejects.toThrow('live-radar 502');
  });
});

describe('useRadar', () => {
  it("is 'off' without config or regions and never fetches", async () => {
    const f = okFetcher();
    expect((await render(['conus'], { config: null, fetcher: f }))().state).toBe('off');
    expect((await render([], { config, fetcher: f }))().state).toBe('off');
    expect(f).not.toHaveBeenCalled();
  });

  it("goes ready with frames and attribution (no polling when refreshMs is 0)", async () => {
    const f = okFetcher();
    const get = await render(['conus', 'hi'], { config, fetcher: f, refreshMs: 0, now });
    expect(get().state).toBe('ready');
    expect(get().attribution).toBe('Radar: NOAA/NWS MRMS');
    expect(get().frames.map((x) => x.region)).toEqual(['conus']);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("is 'error' when the first load fails", async () => {
    const f: Fetcher = async () => {
      throw new Error('net');
    };
    expect((await render(['conus'], { config, fetcher: f, refreshMs: 0, now }))().state).toBe('error');
  });

  it('keeps old frames, flagged stale, when a later poll fails', async () => {
    jest.useFakeTimers();
    try {
      let fail = false;
      const f: Fetcher = async () => {
        if (fail) throw new Error('net');
        return { ok: true, status: 200, json: async () => body };
      };
      const get = await render(['conus'], { config, fetcher: f, refreshMs: C.clientRefresh.minMs, now });
      expect(get().frames[0].stale).toBe(false);
      fail = true;
      await act(async () => {
        jest.advanceTimersByTime(C.clientRefresh.minMs);
      });
      expect(get().state).toBe('ready');
      expect(get().frames[0].stale).toBe(true);
    } finally {
      await act(async () => {
        while (mounted.length) mounted.pop()!.unmount();
      });
      jest.useRealTimers();
    }
  });
});
