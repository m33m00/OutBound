/**
 * Skia side of the radar overlay with a mocked Skia (no native module, no
 * network): decode wiring, empty input draws nothing, one drawVertices per
 * visible region with the configured opacity.
 */
const mockDrawVertices = jest.fn();
const mockMakeVertices = jest.fn((...args: unknown[]) => ({ kind: 'vertices', args }));
const mockFromBytes = jest.fn((bytes: Uint8Array) => ({ kind: 'data', bytes }));
const mockMakeImage = jest.fn((data: unknown) => (data ? { kind: 'image' } : null));
const mockSetAlphaf = jest.fn();

jest.mock('@shopify/react-native-skia', () => ({
  BlendMode: { Dst: 1 },
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
  TileMode: { Clamp: 0 },
  VertexMode: { Triangles: 0 },
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    PictureRecorder: () => ({
      beginRecording: () => ({ drawVertices: mockDrawVertices }),
      finishRecordingAsPicture: () => ({ kind: 'picture' }),
    }),
    Paint: () => ({ setAntiAlias: jest.fn(), setAlphaf: mockSetAlphaf, setShader: jest.fn() }),
    MakeVertices: (...args: unknown[]) => mockMakeVertices(...args),
    Data: { fromBytes: (b: Uint8Array) => mockFromBytes(b) },
    Image: { MakeImageFromEncoded: (d: unknown) => mockMakeImage(d) },
  },
}));

import type { Viewport } from '../camera';
import type { DecodedRadar } from '../radar';
import { decodeRadarImage, makeRadarImageCache, recordRadarLayer } from '../radarLayer';

const vp: Viewport = { width: 400, height: 800, insets: { top: 0, right: 0, bottom: 0, left: 0 } };

function fakeImage(width = 1536, height = 768) {
  return {
    width: () => width,
    height: () => height,
    makeShaderOptions: jest.fn(() => ({ kind: 'shader' })),
    dispose: jest.fn(),
  };
}

function decoded(bbox: DecodedRadar<unknown>['bbox']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { region: 'conus', bbox, image: fakeImage() as any };
}

beforeEach(() => jest.clearAllMocks());

describe('recordRadarLayer', () => {
  it('records nothing for no layers', () => {
    expect(recordRadarLayer({ camera: { center: [-97, 38], radius: 180 }, viewport: vp, layers: [], opacity: 0.6 })).toBeNull();
    expect(mockDrawVertices).not.toHaveBeenCalled();
  });

  it('draws one textured mesh per visible region at the given opacity', () => {
    const pic = recordRadarLayer({
      camera: { center: [-97, 38], radius: 180 },
      viewport: vp,
      layers: [decoded([-130, 20, -60, 55]), decoded([-164, 15, -151, 26])],
      opacity: 0.6,
    });
    expect(pic).not.toBeNull();
    expect(mockDrawVertices).toHaveBeenCalledTimes(2);
    expect(mockSetAlphaf).toHaveBeenCalledWith(0.6);
    const [mode, positions, texs, colors, indices] = mockMakeVertices.mock.calls[0];
    expect(mode).toBe(0);
    expect((positions as unknown[]).length).toBe(36 * 19);
    expect((texs as unknown[]).length).toBe(36 * 19);
    expect(colors).toBeUndefined();
    expect((indices as number[]).length).toBe(35 * 18 * 6);
  });

  it('records nothing when every region is on the far side', () => {
    const pic = recordRadarLayer({
      camera: { center: [83, -38], radius: 180 },
      viewport: vp,
      layers: [decoded([-130, 20, -60, 55])],
      opacity: 0.6,
    });
    expect(pic).toBeNull();
    expect(mockDrawVertices).not.toHaveBeenCalled();
  });
});

describe('decode cache with Skia', () => {
  it('decodes via MakeImageFromEncoded(Data.fromBytes) once per observedAt and disposes replaced images', () => {
    const cache = makeRadarImageCache();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const L = { region: 'conus', bbox: [-130, 20, -60, 55] as const, observedAt: 't1', bytes };
    const [a] = cache.sync([L]);
    cache.sync([{ ...L }]);
    expect(mockFromBytes).toHaveBeenCalledTimes(1);
    expect(mockFromBytes).toHaveBeenCalledWith(bytes);
    expect(mockMakeImage).toHaveBeenCalledTimes(1);
    const dispose = jest.fn();
    (a.image as unknown as { dispose: () => void }).dispose = dispose;
    cache.sync([{ ...L, observedAt: 't2' }]);
    expect(mockMakeImage).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('skips empty bytes without calling Skia', () => {
    expect(decodeRadarImage(new Uint8Array())).toBeNull();
    expect(mockMakeImage).not.toHaveBeenCalled();
  });
});
