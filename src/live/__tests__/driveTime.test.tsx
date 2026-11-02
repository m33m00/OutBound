import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  driveTimeKey,
  etaUrl,
  parseDriveTimeRequest,
  parseEtaResponse,
  readAppleMapsKey,
} from '../../../supabase/functions/_shared/driveTime';
import type { Fetcher } from '../airportStatus';
import { buildDriveTimeUrl } from '../driveTime';
import { clearDriveTimeMemo, useDriveTime, type LiveDrive } from '../useDriveTime';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.parse('2026-11-01T12:00:00Z');
const config = { baseUrl: 'https://x.supabase.co', anonKey: 'anon' };
const home = { lat: 36.16271, lon: -86.78164 };
const bna = { lat: 36.1245, lon: -86.6782 };

describe('live-drive-time helpers', () => {
  it('rounds the origin to about 100 m and clamps the departure', () => {
    const q = new URLSearchParams({ from: '36.16271,-86.78164', to: '36.1245,-86.6782', depart: String(NOW + 3_600_000) });
    const r = parseDriveTimeRequest(q, NOW)!;
    expect(r.origin).toEqual({ lat: 36.163, lon: -86.782 });
    expect(r.departMs).toBe(NOW + 3_600_000);
    expect(parseDriveTimeRequest(new URLSearchParams({ from: '36,-86', to: '36,-86', depart: String(NOW - 1) }), NOW)!.departMs).toBe(NOW);
    expect(parseDriveTimeRequest(new URLSearchParams({ from: '999,0', to: '36,-86' }), NOW)).toBeNull();
    expect(parseDriveTimeRequest(new URLSearchParams({ to: '36,-86' }), NOW)).toBeNull();
  });

  it('asks Apple for a car ETA, with a departure date only for a later start', () => {
    const later = parseDriveTimeRequest(new URLSearchParams({ from: '36.16,-86.78', to: '36.12,-86.68', depart: String(NOW + 3_600_000) }), NOW)!;
    const url = new URL(etaUrl(later, NOW));
    expect(url.origin + url.pathname).toBe('https://maps-api.apple.com/v1/etas');
    expect(url.searchParams.get('transportType')).toBe('Automobile');
    expect(url.searchParams.get('departureDate')).toBe('2026-11-01T13:00:00Z');
    const now = { ...later, departMs: NOW };
    expect(new URL(etaUrl(now, NOW)).searchParams.get('departureDate')).toBeNull();
    expect(driveTimeKey(later)).not.toBe(driveTimeKey(now));
  });

  it('reads Apple’s answer in whole minutes, and says no route when there is none', () => {
    expect(parseEtaResponse({ etas: [{ distanceMeters: 30400, expectedTravelTimeSeconds: 1930, staticTravelTimeSeconds: 1500 }] }, 'at')).toEqual({
      available: true,
      minutes: 32,
      typicalMinutes: 25,
      distanceKm: 30.4,
      attribution: 'Apple Maps',
      fetchedAt: 'at',
    });
    expect(parseEtaResponse({ etas: [] }, 'at')).toEqual({ available: false, reason: 'no_route' });
  });

  it('needs all three Apple secrets, and fixes a pasted key’s \\n', () => {
    const env = { APPLE_MAPS_TEAM_ID: 'T', APPLE_MAPS_KEY_ID: 'K', APPLE_MAPS_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----' };
    expect(readAppleMapsKey((k) => env[k as keyof typeof env])?.privateKey).toBe('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
    expect(readAppleMapsKey((k) => (k === 'APPLE_MAPS_KEY_ID' ? undefined : env[k as keyof typeof env]))).toBeNull();
  });

  it('the app sends its origin at about 100 m', () => {
    const url = new URL(buildDriveTimeUrl(config, home, bna, NOW));
    expect(url.pathname).toBe('/functions/v1/live-drive-time');
    expect(url.searchParams.get('from')).toBe('36.163,-86.782');
  });
});

describe('useDriveTime', () => {
  const mounted: ReactTestRenderer[] = [];
  afterEach(async () => {
    while (mounted.length) await act(async () => mounted.pop()!.unmount());
    clearDriveTimeMemo();
  });
  const render = async (fetcher: Fetcher, cfg: typeof config | null = config) => {
    let latest: LiveDrive | null = null;
    function C() {
      latest = useDriveTime(home, bna, NOW, { fetcher, config: cfg });
      return null;
    }
    await act(async () => void mounted.push(create(<C />)));
    return () => latest;
  };

  it('gives the maps minutes once they come back', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ available: true, minutes: 18, attribution: 'Apple Maps' }) }));
    const get = await render(fetcher);
    expect(get()).toEqual({ minutes: 18, source: 'Apple Maps' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stays null (rough estimate) when the function isn’t set up, isn’t deployed, or live data is off', async () => {
    const notSet = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ available: false, reason: 'not_configured' }) }));
    expect((await render(notSet))()).toBeNull();
    clearDriveTimeMemo();
    const missing = jest.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    expect((await render(missing))()).toBeNull();
    const off = jest.fn();
    expect((await render(off as unknown as Fetcher, null))()).toBeNull();
    expect(off).not.toHaveBeenCalled();
  });
});
