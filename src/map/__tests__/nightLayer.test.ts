/** Night layer with a mocked Skia: uniforms, draw calls and the shader source. */
const mockDrawCircle = jest.fn();
const mockMakeShader = jest.fn((u: number[]) => ({ kind: 'shader', u }));
const mockEffectMake = jest.fn((_src: string) => ({ makeShader: mockMakeShader }));

jest.mock('@shopify/react-native-skia', () => ({
  ClipOp: { Intersect: 1 },
  TileMode: { Clamp: 0 },
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    PictureRecorder: () => ({
      beginRecording: () => ({ drawCircle: mockDrawCircle, save: jest.fn(), restore: jest.fn(), clipPath: jest.fn() }),
      finishRecordingAsPicture: () => ({ kind: 'picture' }),
    }),
    Paint: () => ({ setAntiAlias: jest.fn(), setShader: jest.fn() }),
    Path: { Circle: jest.fn(() => ({ kind: 'circle' })) },
    Color: (c: string) => c,
    Shader: { MakeRadialGradient: jest.fn(() => ({ kind: 'gradient' })) },
    RuntimeEffect: { Make: (src: string) => mockEffectMake(src) },
  },
}));

import type { GlobeCamera, Viewport } from '../camera';
import { highlightAlpha, NIGHT_SKSL, nightUniforms, recordNightLayer } from '../nightLayer';
import { NIGHT, NIGHT_THEME, SUN_HIGHLIGHT } from '../sun';

const vp: Viewport = { width: 400, height: 800, insets: { top: 0, right: 0, bottom: 200, left: 0 } };
const cam: GlobeCamera = { center: [0, 0], radius: 150 };

beforeEach(() => jest.clearAllMocks());

describe('night layer', () => {
  it('builds the shader from the same constants as nightAlpha', () => {
    expect(NIGHT_SKSL).toContain(`(${NIGHT.start} - d) / ${NIGHT.span}`);
    expect(NIGHT_SKSL).toContain(`${NIGHT.duskPeak} * exp(-gz * gz)`);
    expect(NIGHT_SKSL).toContain(`/ ${NIGHT.duskWidth}`);
  });

  it('passes origin, radius, view-space sun, colors and boosted night alpha', () => {
    const u = nightUniforms({ ...cam, offsetY: -20 }, vp, [0, 0], NIGHT_THEME.light);
    expect(u).toHaveLength(13);
    expect(u.slice(0, 3)).toEqual([200, 300 - 20, 150]);
    expect(u[3]).toBeCloseTo(0, 9);
    expect(u[4]).toBeCloseTo(0, 9);
    expect(u[5]).toBeCloseTo(1, 9);
    expect(u.slice(6, 9)).toEqual([12 / 255, 20 / 255, 44 / 255]);
    expect(u[12]).toBeCloseTo(0.42 * 1.08, 9);
  });

  it('draws the sun highlight then one shaded disk when the sun faces us', () => {
    recordNightLayer({ camera: cam, viewport: vp, sun: [0, 0], theme: NIGHT_THEME.dark });
    expect(mockDrawCircle).toHaveBeenCalledTimes(2);
    expect(mockDrawCircle.mock.calls[0]).toEqual([200, 300, 150 * SUN_HIGHLIGHT.radius, expect.anything()]);
    expect(mockDrawCircle.mock.calls[1]).toEqual([200, 300, 150, expect.anything()]);
    expect(mockMakeShader).toHaveBeenCalledTimes(1);
  });

  it('has no highlight when the sun is behind the globe, fading near the limb', () => {
    recordNightLayer({ camera: cam, viewport: vp, sun: [180, 0], theme: NIGHT_THEME.dark });
    expect(mockDrawCircle).toHaveBeenCalledTimes(1);
    expect(highlightAlpha(-0.2)).toBe(0);
    expect(highlightAlpha(SUN_HIGHLIGHT.fadeZ / 2)).toBeCloseTo(SUN_HIGHLIGHT.alpha / 2, 9);
    expect(highlightAlpha(1)).toBe(SUN_HIGHLIGHT.alpha);
  });
});
