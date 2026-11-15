"""Draws the Jaunt plane-and-contrail on its own, for the route title (round 208).

Same shapes as src/brand/jauntMark.ts (the t's contrail and the plane), in white on clear so the app
tints it. Writes assets/images/trail-mark.png plus @2x and @3x. Run from the repo root.
"""
import math
from PIL import Image, ImageDraw

TAIL = (2035.34, -579.71)
HEAD = (2729.82, -727.32)
W0, W1 = 49.56, 118.0
PLANE = (2847.2, -752.27)
HEADING = -0.20944
PSCALE = 2.3
OUTLINE = [(0.0, -47.0), (2.54, -46.04), (4.42, -43.44), (5.6, -39.62), (6.0, -35.0), (6.0, -14.0), (45.0, 9.0), (45.0, 19.0),
           (6.0, 6.0), (6.0, 27.0), (19.0, 36.0), (19.0, 44.0), (0.0, 39.0), (-19.0, 44.0), (-19.0, 36.0), (-6.0, 27.0),
           (-6.0, 6.0), (-45.0, 19.0), (-45.0, 9.0), (-6.0, -14.0), (-6.0, -35.0), (-5.6, -39.62), (-4.42, -43.44), (-2.54, -46.04)]

def trail():
    (tx, ty), (hx, hy) = TAIL, HEAD
    ln = math.hypot(hx - tx, hy - ty); nx, ny = -(hy - ty) / ln, (hx - tx) / ln
    return [(tx + nx * W0 / 2, ty + ny * W0 / 2), (hx + nx * W1 / 2, hy + ny * W1 / 2), (hx - nx * W1 / 2, hy - ny * W1 / 2), (tx - nx * W0 / 2, ty - ny * W0 / 2)]

def plane():
    a = HEADING + math.pi / 2; c, s = math.cos(a), math.sin(a)
    return [(PLANE[0] + (x * c - y * s) * PSCALE, PLANE[1] + (x * s + y * c) * PSCALE) for x, y in OUTLINE]

shapes = [trail(), plane()]
xs = [p[0] for sh in shapes for p in sh]; ys = [p[1] for sh in shapes for p in sh]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
H_PT = 14  # the mark's height in points
for mult, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
    k = H_PT * mult / (maxy - miny); ss = 4
    w = math.ceil((maxx - minx) * k); h = math.ceil((maxy - miny) * k)
    im = Image.new('RGBA', (w * ss, h * ss), (255, 255, 255, 0)); d = ImageDraw.Draw(im)
    for sh in shapes:
        d.polygon([((x - minx) * k * ss, (y - miny) * k * ss) for x, y in sh], fill=(255, 255, 255, 255))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(f'assets/images/trail-mark{suffix}.png', optimize=True)
    if mult == 1:
        print('size pt', w, h)
