import {
  backoffMs,
  buildCapabilitiesUrl,
  buildImageRoute,
  buildImageUrl,
  createRadarService,
  frameStatus,
  imageHeight,
  needsNewImage,
  newRegionState,
  parseCapabilitiesTime,
  parseImageRegion,
  parseRegions,
  shouldCheck,
  validateImageTime,
} from '../../../supabase/functions/_shared/radar';
import { RADAR_CONFIG as C } from '../../../supabase/functions/_shared/radarConfig';
import {
  CAPABILITIES_NO_DEFAULT,
  CONUS_CAPABILITIES,
  CONUS_LATEST_ISO,
  CONUS_LATEST_MS,
  tinyPng,
} from '../fixtures/radar-samples';

describe('radar pure helpers', () => {
  it('parses the latest frame time from the default attribute, else the last listed time', () => {
    expect(parseCapabilitiesTime(CONUS_CAPABILITIES)).toBe(CONUS_LATEST_ISO);
    expect(parseCapabilitiesTime(CAPABILITIES_NO_DEFAULT)).toBe(CONUS_LATEST_ISO);
    expect(parseCapabilitiesTime('<x/>')).toBeNull();
    expect(parseCapabilitiesTime('<Dimension name="time" default="junk">nope</Dimension>')).toBeNull();
  });

  it('parses regions: canonical order, deduped, unknown reported', () => {
    expect(parseRegions('hi, CONUS,hi')).toEqual({ regions: ['conus', 'hi'], invalid: [] });
    expect(parseRegions('guam,ak')).toEqual({ regions: ['ak'], invalid: ['guam'] });
    expect(parseRegions(null).regions).toEqual([]);
  });

  it('image param must be exactly one known region', () => {
    expect(parseImageRegion('conus')).toBe('conus');
    expect(parseImageRegion('CONUS')).toBe('conus');
    for (const bad of ['conus,guam', 'conus,hi', 'guam', '', null]) expect(parseImageRegion(bad)).toBeNull();
  });

  it('derives image height from the box aspect', () => {
    expect(imageHeight('conus')).toBe(768);
    expect(imageHeight('ak')).toBe(676);
    expect(imageHeight('carib')).toBe(768);
    expect(imageHeight('hi')).toBe(866);
  });

  it('builds upstream and route URLs', () => {
    expect(buildCapabilitiesUrl('hi')).toBe(
      `${C.wmsBase}/hawaii/hawaii_bref_qcd/ows?service=WMS&version=1.3.0&request=GetCapabilities`,
    );
    const u = new URL(buildImageUrl('conus', CONUS_LATEST_ISO));
    expect(u.pathname).toBe('/geoserver/conus/conus_bref_qcd/ows');
    expect(u.searchParams.get('crs')).toBe('CRS:84');
    expect(u.searchParams.get('bbox')).toBe('-130,20,-60,55');
    expect(u.searchParams.get('width')).toBe('1536');
    expect(u.searchParams.get('height')).toBe('768');
    expect(u.searchParams.get('time')).toBe(CONUS_LATEST_ISO);
    expect(buildImageRoute('conus', CONUS_LATEST_ISO)).toBe('?image=conus&t=2026-10-14T07%3A16%3A16Z');
  });

  it('backs off exponentially up to the cap', () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(C.backoff.baseMs);
    expect(backoffMs(2)).toBe(C.backoff.baseMs * C.backoff.factor);
    expect(backoffMs(50)).toBe(C.backoff.maxMs);
  });

  it('freshness decision: check on interval, honor backoff, refetch image only for newer frames', () => {
    const s = newRegionState();
    expect(shouldCheck(s, 1000)).toBe(true);
    s.checkedAt = 1000;
    expect(shouldCheck(s, 1000 + C.capabilitiesCheckMs - 1)).toBe(false);
    expect(shouldCheck(s, 1000 + C.capabilitiesCheckMs)).toBe(true);
    s.nextRetryAt = 1000 + C.capabilitiesCheckMs + 5000;
    expect(shouldCheck(s, 1000 + C.capabilitiesCheckMs)).toBe(false);
    expect(needsNewImage(null, 5)).toBe(true);
    expect(needsNewImage(5, 5)).toBe(false);
    expect(needsNewImage(5, 6)).toBe(true);
  });

  it('stale / available rule: unknown frame is unavailable; failing or old is stale; very old is unavailable', () => {
    const base = { checkedAt: 0, nextRetryAt: 0 };
    expect(frameStatus(newRegionState(), 1)).toEqual({ stale: true, available: false });
    const fresh = { ...base, observedMs: CONUS_LATEST_MS, failures: 0 };
    expect(frameStatus(fresh, CONUS_LATEST_MS + 60_000)).toEqual({ stale: false, available: true });
    expect(frameStatus({ ...fresh, failures: 2 }, CONUS_LATEST_MS + 60_000)).toEqual({ stale: true, available: true });
    expect(frameStatus(fresh, CONUS_LATEST_MS + C.staleAfterMs + 1)).toEqual({ stale: true, available: true });
    expect(frameStatus(fresh, CONUS_LATEST_MS + C.maxAgeMs + 1)).toEqual({ stale: true, available: false });
  });

  it('validates image time', () => {
    const now = CONUS_LATEST_MS + 60_000;
    expect(validateImageTime(CONUS_LATEST_ISO, now)).toBe(CONUS_LATEST_ISO);
    expect(validateImageTime('2026-10-14T07:16:16.000Z', now)).toBe(CONUS_LATEST_ISO);
    expect(validateImageTime(null, now)).toBeNull();
    expect(validateImageTime('garbage', now)).toBeNull();
    expect(validateImageTime(new Date(now + C.futureSkewMs + 1000).toISOString(), now)).toBeNull();
    expect(validateImageTime(new Date(now - C.imageHistoryMs - 1000).toISOString(), now)).toBeNull();
  });
});

describe('radar service (fake upstream, no network)', () => {
  const makeDeps = () => {
    let now = CONUS_LATEST_MS + 60_000;
    const png = tinyPng();
    const deps = {
      now: () => now,
      fetchText: jest.fn(async (_u: string) => CONUS_CAPABILITIES),
      fetchBytes: jest.fn(async (_u: string) => png),
    };
    return { deps, png, advance: (ms: number) => (now += ms) };
  };

  it('serves JSON from capabilities only (no image fetch) with the contract fields', async () => {
    const { deps } = makeDeps();
    const svc = createRadarService(deps);
    const res = await svc.getRegions(['conus']);
    expect(res.attribution).toBe('Radar: NOAA/NWS MRMS');
    expect(res.regions[0]).toEqual({
      region: 'conus',
      observedAt: CONUS_LATEST_ISO,
      bbox: [-130, 20, -60, 55],
      width: 1536,
      height: 768,
      imageUrl: '?image=conus&t=2026-10-14T07%3A16%3A16Z',
      stale: false,
      available: true,
    });
    expect(deps.fetchBytes).not.toHaveBeenCalled();
    expect(deps.fetchText).toHaveBeenCalledTimes(1);
  });

  it('fetches only requested regions and checks each at most once per interval, with one in-flight read', async () => {
    const { deps, advance } = makeDeps();
    const svc = createRadarService(deps);
    await Promise.all([svc.getRegions(['conus']), svc.getRegions(['conus', 'hi'])]);
    expect(deps.fetchText).toHaveBeenCalledTimes(2); // conus once (shared), hi once
    await svc.getRegions(['conus']);
    expect(deps.fetchText).toHaveBeenCalledTimes(2);
    advance(C.capabilitiesCheckMs);
    await svc.getRegions(['conus']);
    expect(deps.fetchText).toHaveBeenCalledTimes(3);
  });

  it('fetches an image once per frame (in-flight shared, then held)', async () => {
    const { deps, png } = makeDeps();
    const svc = createRadarService(deps);
    const [a, b] = await Promise.all([svc.getImage('conus', CONUS_LATEST_ISO), svc.getImage('conus', CONUS_LATEST_ISO)]);
    expect(a?.bytes).toBe(png);
    expect(b?.bytes).toBe(png);
    await svc.getImage('conus', CONUS_LATEST_ISO);
    expect(deps.fetchBytes).toHaveBeenCalledTimes(1);
    expect(deps.fetchBytes.mock.calls[0][0]).toContain('time=2026-10-14T07%3A16%3A16Z');
  });

  it('on upstream failure keeps the last frame, flags stale, backs off, then hides after maxAge', async () => {
    const { deps, advance } = makeDeps();
    const svc = createRadarService(deps);
    await svc.getRegions(['conus']);
    deps.fetchText.mockRejectedValue(new Error('down'));
    advance(C.capabilitiesCheckMs);
    let r = (await svc.getRegions(['conus'])).regions[0];
    expect(r).toMatchObject({ observedAt: CONUS_LATEST_ISO, stale: true, available: true });
    const calls = deps.fetchText.mock.calls.length;
    advance(C.backoff.baseMs - 1000); // inside backoff: no upstream call
    await svc.getRegions(['conus']);
    expect(deps.fetchText).toHaveBeenCalledTimes(calls);
    advance(C.maxAgeMs);
    r = (await svc.getRegions(['conus'])).regions[0];
    expect(r).toMatchObject({ stale: true, available: false, imageUrl: null });
  });

  it('with no data at all reports unavailable, never an empty "clear" frame', async () => {
    const { deps } = makeDeps();
    deps.fetchText.mockRejectedValue(new Error('down'));
    const r = (await createRadarService(deps).getRegions(['hi'])).regions[0];
    expect(r).toMatchObject({ observedAt: null, imageUrl: null, stale: true, available: false });
  });

  it('serves the held image (stale) when the upstream image fails', async () => {
    const { deps, png } = makeDeps();
    const svc = createRadarService(deps);
    await svc.getImage('conus', CONUS_LATEST_ISO);
    deps.fetchBytes.mockRejectedValue(new Error('down'));
    const older = new Date(CONUS_LATEST_MS - 120_000).toISOString();
    const r = await svc.getImage('conus', older);
    expect(r).toEqual({ bytes: png, observedAt: CONUS_LATEST_ISO, stale: true });
    expect(await createRadarService(deps).getImage('hi', CONUS_LATEST_ISO)).toBeNull();
  });
});
