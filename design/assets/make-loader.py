"""Draws the Jaunt loader's three layers: the t's stem, its contrail and the plane (round 223).

John: "Can you streamline the animation of the T across the app. Where it uses the plane and trail. For anything
loading etc". The loader is the t from the wordmark, with its crossbar drawn as a contrail by the plane, the same
story as the launch screen. Shapes are the ones in src/brand/jauntMark.ts, in white on clear so the app tints them.
All three pictures share one frame, so they stack; the plane is drawn where it starts (at the trail's tail) and
the app moves it. Writes assets/images/loader-{stem,trail,plane}.png plus @2x and @3x. Run from the repo root.
"""
import math
import re
from PIL import Image, ImageDraw

STEM = ('M2474 7Q2399 7 2350.5 -12.5Q2302 -32 2278 -78.5Q2254 -125 2254 -204L2255 -640H2385L2384 -195Q2384 -155 '
        '2405.5 -133.5Q2427 -112 2467 -112H2552V7Z')
TAIL = (2035.34, -579.71)
HEAD = (2729.82, -727.32)
W0, W1 = 49.56, 118.0
PLANE = (2847.2, -752.27)
HEADING = -0.20944
PSCALE = 2.3
OUTLINE = [(0.0, -47.0), (2.54, -46.04), (4.42, -43.44), (5.6, -39.62), (6.0, -35.0), (6.0, -14.0), (45.0, 9.0), (45.0, 19.0),
           (6.0, 6.0), (6.0, 27.0), (19.0, 36.0), (19.0, 44.0), (0.0, 39.0), (-19.0, 44.0), (-19.0, 36.0), (-6.0, 27.0),
           (-6.0, 6.0), (-45.0, 19.0), (-45.0, 9.0), (-6.0, -14.0), (-6.0, -35.0), (-5.6, -39.62), (-4.42, -43.44), (-2.54, -46.04)]

# The frame, in font units: the stem, the trail and the plane at both ends of its run.
FRAME = (1960.0, -880.0, 2990.0, 30.0)
H_PT = 40  # the picture's height in points at 1x; the app draws it smaller


def stem():
    toks = re.findall(r'[MQLHVZ]|-?\d+(?:\.\d+)?', STEM)
    pts, i, cur, cmd = [], 0, (0.0, 0.0), None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd == 'Z':
                continue
        if cmd in ('M', 'L'):
            cur = (float(toks[i]), float(toks[i + 1])); i += 2; pts.append(cur)
        elif cmd == 'H':
            cur = (float(toks[i]), cur[1]); i += 1; pts.append(cur)
        elif cmd == 'V':
            cur = (cur[0], float(toks[i])); i += 1; pts.append(cur)
        elif cmd == 'Q':
            c = (float(toks[i]), float(toks[i + 1])); e = (float(toks[i + 2]), float(toks[i + 3])); i += 4
            for k in range(1, 13):
                u = k / 12
                pts.append(((1 - u) ** 2 * cur[0] + 2 * (1 - u) * u * c[0] + u * u * e[0],
                            (1 - u) ** 2 * cur[1] + 2 * (1 - u) * u * c[1] + u * u * e[1]))
            cur = e
    return pts


def trail():
    (tx, ty), (hx, hy) = TAIL, HEAD
    ln = math.hypot(hx - tx, hy - ty); nx, ny = -(hy - ty) / ln, (hx - tx) / ln
    return [(tx + nx * W0 / 2, ty + ny * W0 / 2), (hx + nx * W1 / 2, hy + ny * W1 / 2), (hx - nx * W1 / 2, hy - ny * W1 / 2), (tx - nx * W0 / 2, ty - ny * W0 / 2)]


def plane_at_start():
    cx, cy = TAIL[0] + PLANE[0] - HEAD[0], TAIL[1] + PLANE[1] - HEAD[1]
    a = HEADING + math.pi / 2; c, s = math.cos(a), math.sin(a)
    return [(cx + (x * c - y * s) * PSCALE, cy + (x * s + y * c) * PSCALE) for x, y in OUTLINE]


x0, y0, x1, y1 = FRAME
for name, shape in (('stem', stem()), ('trail', trail()), ('plane', plane_at_start())):
    for mult, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
        k = H_PT * mult / (y1 - y0); ss = 4
        w = math.ceil((x1 - x0) * k); h = math.ceil((y1 - y0) * k)
        im = Image.new('RGBA', (w * ss, h * ss), (255, 255, 255, 0))
        ImageDraw.Draw(im).polygon([((x - x0) * k * ss, (y - y0) * k * ss) for x, y in shape], fill=(255, 255, 255, 255))
        im.resize((w, h), Image.LANCZOS).save(f'assets/images/loader-{name}{suffix}.png', optimize=True)
print('frame', FRAME, 'aspect', round((x1 - x0) / (y1 - y0), 4))
