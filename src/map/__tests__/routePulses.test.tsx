/**
 * The route pulse (round 85) crashed the app on Find Routes in Expo Go when it ran on Reanimated
 * (Skia's useClock + useDerivedValue). It now records a plain Skia Picture on the JS thread. These
 * tests keep it that way and check the frame recorder with a mocked Skia.
 */
const mockDrawPath = jest.fn();
const mockTrim = jest.fn((path: unknown, start: number, end: number) => ({ kind: 'trimmed', path, start, end }));

jest.mock('@shopify/react-native-skia', () => ({
  BlurStyle: { Solid: 1 },
  PaintStyle: { Stroke: 1 },
  StrokeCap: { Round: 1 },
  StrokeJoin: { Round: 1 },
  Picture: () => null,
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    PictureRecorder: () => ({
      beginRecording: () => ({ drawPath: mockDrawPath }),
      finishRecordingAsPicture: () => ({ kind: 'picture' }),
    }),
    Paint: () => ({
      setAntiAlias: jest.fn(),
      setStyle: jest.fn(),
      setStrokeWidth: jest.fn(),
      setStrokeCap: jest.fn(),
      setStrokeJoin: jest.fn(),
      setColor: jest.fn(),
      setMaskFilter: jest.fn(),
    }),
    Color: (c: string) => c,
    MaskFilter: { MakeBlur: () => ({ kind: 'blur' }) },
    Path: { Trim: (p: unknown, s: number, e: number) => mockTrim(p, s, e) },
  },
}));

import type { SkPath } from '@shopify/react-native-skia';

import { PULSE } from '../pulse';
import type { RoutePulse } from '../routeLayer';
import { recordPulseFrame } from '../RoutePulses';

// Node's fs runs under jest; the app's types don't include Node, so it's declared here.
declare const require: (m: string) => unknown;
declare const __dirname: string;
const fs = require('fs') as {
  readFileSync: (path: string, enc: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((name) => {
    const p = `${dir}/${name}`;
    if (fs.statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

const pulse = (over: Partial<RoutePulse> = {}): RoutePulse => ({
  key: 'a',
  path: { kind: 'path' } as unknown as SkPath,
  width: 3,
  legIndex: 0,
  legCount: 1,
  selected: true,
  ...over,
});

describe('route pulse', () => {
  beforeEach(() => {
    mockDrawPath.mockClear();
    mockTrim.mockClear();
  });

  it('app code never animates through Reanimated worklets (the Find Routes crash)', () => {
    const offenders = sourceFiles(`${__dirname}/../..`).filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /from 'react-native-reanimated'|\buseClock\b|\buseDerivedValue\b/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it('draws the bright stretch of each leg mid-pulse', () => {
    const ms = PULSE.legMs / 2;
    const pic = recordPulseFrame([pulse(), pulse({ key: 'b', selected: false })], ms, 400, 800);
    expect(pic).toEqual({ kind: 'picture' });
    expect(mockDrawPath).toHaveBeenCalledTimes(2);
    const [, start, end] = mockTrim.mock.calls[0];
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(1);
    expect(end).toBeGreaterThan(start);
  });

  it('draws nothing when a trim fails, without throwing', () => {
    mockTrim.mockReturnValueOnce(null as never);
    expect(() => recordPulseFrame([pulse()], PULSE.legMs / 2, 400, 800)).not.toThrow();
    expect(mockDrawPath).not.toHaveBeenCalled();
  });

  it('returns no picture with no routes', () => {
    expect(recordPulseFrame([], 0, 400, 800)).toBeNull();
  });
});
