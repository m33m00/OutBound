"""
Jaunt brand assets (John, 2026-11-14: rename OutBound to Jaunt; picked the lowercase "jaunt"
wordmark from logo round 2 and the tall t app icon).

The mark: the t's crossbar is a contrail that tilts up and widens to the right, with a small plane
flying just ahead of it. Letters are Sora SemiBold (600), the app's font.

  pip install fonttools cairosvg
  python3 design/assets/make-jaunt.py /path/to/Sora[wght].ttf

Writes src/brand/jauntMark.ts (the wordmark as shapes, drawn in the app with Skia) and the icon
PNGs into assets/images/ (icon.png, android-icon-*.png, favicon.png, splash.png).
"""
import io
import math
import os
import sys

import cairosvg
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLUE = '#1C5FD4'  # boarding blue
WHITE = '#FFFFFF'

font = TTFont(sys.argv[1])
if 'fvar' in font:
    instantiateVariableFont(font, {'wght': 600}, inplace=True)
gs = font.getGlyphSet()
cmap = font.getBestCmap()


def glyph(ch, x):
    """A glyph's outline as an SVG path, y flipped so up is negative, baseline at 0."""
    p = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    gs[cmap[ord(ch)]].draw(TransformPen(p, (1, 0, 0, -1, x, 0)))
    return p.getCommands()


def t_stem(x, top):
    """Sora's t stem with its curved foot, its top cut where the contrail crosses it."""
    return (f'M{x+315} 7Q{x+240} 7 {x+191.5} -12.5Q{x+143} -32 {x+119} -78.5Q{x+95} -125 {x+95} -204'
            f'L{x+96} {top:g}H{x+226}L{x+225} -195Q{x+225} -155 {x+246.5} -133.5Q{x+268} -112 {x+308} -112H{x+393}V7Z')


# The plane, nose up, centred on its middle, in plane units (100 = nose to tail fins).
def _plane_outline():
    def cubic(p0, p1, p2, p3, n):
        out = []
        for k in range(1, n + 1):
            t = k / n
            u = 1 - t
            out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                        u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
        return out
    right = [(50, 3)] + cubic((50, 3), (53.8, 3), (56, 8.5), (56, 15), 4)
    right += [(56, 36), (95, 59), (95, 69), (56, 56), (56, 77), (69, 86), (69, 94), (50, 89)]
    left = [(100 - x, y) for x, y in reversed(right[1:-1])]
    return [(round(x - 50, 2), round(y - 50, 2)) for x, y in right + left]


PLANE = _plane_outline()


def contrail(cx, cy, deg, left, right, w0, w1, psize, gap):
    """The contrail through (cx, cy), rising `deg` to the right, and the plane ahead of its tip."""
    a = math.radians(deg)
    dx, dy = math.cos(a), -math.sin(a)
    tail = (cx - dx * left, cy - dy * left)
    head = (cx + dx * right, cy + dy * right)
    plane = (head[0] + dx * gap, head[1] + dy * gap)
    return dict(tail=tail, head=head, w0=w0, w1=w1, plane=plane, heading=-a, scale=psize / 100)


def trail_points(c, share=1.0):
    tx, ty = c['tail']
    hx = tx + (c['head'][0] - tx) * share
    hy = ty + (c['head'][1] - ty) * share
    w = c['w0'] + (c['w1'] - c['w0']) * share
    L = math.hypot(c['head'][0] - tx, c['head'][1] - ty)
    nx, ny = -(c['head'][1] - ty) / L, (c['head'][0] - tx) / L
    return [(tx + nx * c['w0'] / 2, ty + ny * c['w0'] / 2), (hx + nx * w / 2, hy + ny * w / 2),
            (hx - nx * w / 2, hy - ny * w / 2), (tx - nx * c['w0'] / 2, ty - ny * c['w0'] / 2)]


def plane_points(c):
    h = c['heading'] + math.pi / 2
    cos, sin = math.cos(h), math.sin(h)
    px, py = c['plane']
    return [(px + (x * cos - y * sin) * c['scale'], py + (x * sin + y * cos) * c['scale'])
            for x, y in [(x, y) for x, y in PLANE]]


def poly(pts):
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'


def bbox(paths_pts):
    xs = [p[0] for pts in paths_pts for p in pts]
    ys = [p[1] for pts in paths_pts for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


# ---- Wordmark: lowercase "jaunt" ----
TRACK = -12
xs, x = [], 0
for ch in 'jaunt':
    xs.append(x)
    x += gs[cmap[ord(ch)]].width + TRACK
WORD_W = x - TRACK
T_X = xs[-1]
BAR_Y = -640
WORD_TRAIL = contrail(T_X + 160, BAR_Y, 12, 290, 420, 118 * 0.42, 118, 230, 120)
WORD_LETTERS = [glyph(ch, x) for ch, x in zip('jaun', xs[:-1])] + [t_stem(T_X, BAR_Y)]
_wb = bbox([trail_points(WORD_TRAIL), plane_points(WORD_TRAIL), [(0, 205), (WORD_W, -763)]])

# ---- App icon mark: the tall t ----
ICON_TRAIL = contrail(160, -700, 10, 300, 430, 125 * 0.42, 125, 240, 125)
ICON_STEM = t_stem(0, -700)
_ib = bbox([trail_points(ICON_TRAIL), plane_points(ICON_TRAIL), [(90, 7), (393, -700)]])


def fit(box, W, H, pad):
    x0, y0, x1, y1 = box
    s = min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0))
    return s, (W - (x1 - x0) * s) / 2 - x0 * s, (H - (y1 - y0) * s) / 2 - y0 * s


def icon_svg(size, bg, ink, pad_share):
    s, ox, oy = fit(_ib, 1024, 1024, 1024 * pad_share)
    rect = f'<rect width="1024" height="1024" fill="{bg}"/>' if bg else ''
    inner = (f'<g transform="translate({ox:.1f} {oy:.1f}) scale({s:.5f})" fill="{ink}">'
             f'<path d="{ICON_STEM}"/><path d="{poly(trail_points(ICON_TRAIL))}"/>'
             f'<path d="{poly(plane_points(ICON_TRAIL))}" stroke="{ink}" stroke-width="1.6" stroke-linejoin="round"/></g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024">{rect}{inner}</svg>'


def png(svg, path, opaque=False):
    data = cairosvg.svg2png(bytestring=svg.encode())
    if opaque:
        from PIL import Image
        im = Image.open(io.BytesIO(data)).convert('RGB')
        im.save(path)
    else:
        open(path, 'wb').write(data)


img = os.path.join(ROOT, 'assets', 'images')
png(icon_svg(1024, BLUE, WHITE, 0.2), os.path.join(img, 'icon.png'), opaque=True)
png(icon_svg(512, None, WHITE, 0.33), os.path.join(img, 'android-icon-foreground.png'))
png(f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="{BLUE}"/></svg>',
    os.path.join(img, 'android-icon-background.png'))
png(icon_svg(432, None, WHITE, 0.33), os.path.join(img, 'android-icon-monochrome.png'))
png(icon_svg(48, BLUE, WHITE, 0.16), os.path.join(img, 'favicon.png'))
png('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>', os.path.join(img, 'splash.png'))


def pts_ts(pts):
    return '[' + ', '.join(f'[{x:.2f}, {y:.2f}]' for x, y in pts) + ']'


def trail_ts(c):
    return (f"{{ tail: {{ x: {c['tail'][0]:.2f}, y: {c['tail'][1]:.2f} }}, head: {{ x: {c['head'][0]:.2f}, y: {c['head'][1]:.2f} }}, "
            f"w0: {c['w0']:.2f}, w1: {c['w1']:.2f}, plane: {{ x: {c['plane'][0]:.2f}, y: {c['plane'][1]:.2f} }}, "
            f"heading: {c['heading']:.6f}, planeScale: {c['scale']:.3f} }}")


ts = f'''/**
 * The Jaunt wordmark as shapes (generated by design/assets/make-jaunt.py; don't edit by hand).
 *
 * Lowercase "jaunt" in Sora SemiBold, in font units (1000 = the font's em), baseline at y 0 and up
 * negative. The t's crossbar is a contrail: a straight band from a thin tail to a wide head, rising
 * to the right, with the plane flying just ahead of its head (John, 2026-11-14).
 */

export type Pt = {{ x: number; y: number }};

export interface Trail {{
  tail: Pt;
  head: Pt;
  /** Band width at the tail and at the head. */
  w0: number;
  w1: number;
  /** Plane centre, heading in radians (0 = right, clockwise positive since y points down) and size. */
  plane: Pt;
  heading: number;
  planeScale: number;
}}

/** j, a, u, n and the t's stem (with its foot), as SVG paths. */
export const LETTERS: readonly string[] = {[l for l in WORD_LETTERS]!r};

export const TRAIL: Trail = {trail_ts(WORD_TRAIL)};

/** The plane, nose up, centred on its middle, in plane units. */
export const PLANE_OUTLINE: readonly (readonly [number, number])[] = {pts_ts(PLANE)};

/** Bounding box of the whole wordmark (letters, contrail and plane). */
export const BOX = {{ minX: {_wb[0]:.1f}, minY: {_wb[1]:.1f}, maxX: {_wb[2]:.1f}, maxY: {_wb[3]:.1f} }} as const;
'''
ts = ts.replace("['", "[\n  '").replace("', '", "',\n  '").replace("']", "',\n]")
os.makedirs(os.path.join(ROOT, 'src', 'brand'), exist_ok=True)
open(os.path.join(ROOT, 'src', 'brand', 'jauntMark.ts'), 'w').write(ts)
print('wrote src/brand/jauntMark.ts and assets/images icons')
