"""
Landmark sketches on Jaunt's results tickets (round 221, John: "Landmark sketch but a little more detailed?",
"And different for each one subtly", "Sure lets go with this and can it be animated?").

Draws each airport's hairline sketch and writes assets/images/landmarks/<code>.png: white lines on a clear
background, 3x, sized to the sketch box on the ticket (166 x 73 pt). The app tints them per light or dark mode.
Run from the repo root: python3 design/landmark-sketches.py
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageChops

SS = 2
K = 3 * SS
CW, CH = 360, 172
DIV_Y = 83
GY = 73.0
def P(v): return int(round(v * K))


class Pen:
    """Two masks: firm lines and light hatching. Coordinates in points."""
    def __init__(s, W, H):
        s.main = Image.new("L", (W, H), 0); s.hat = Image.new("L", (W, H), 0)
        s.dm = ImageDraw.Draw(s.main); s.dh = ImageDraw.Draw(s.hat)
    def line(s, pts, w=0.8, light=False):
        (s.dh if light else s.dm).line([(P(x), P(y)) for x, y in pts], fill=255, width=max(1, P(w)), joint="curve")
    def poly(s, pts, w=0.8): s.line(list(pts) + [pts[0]], w)
    def ell(s, box, w=0.8, light=False):
        x0, y0, x1, y1 = box
        (s.dh if light else s.dm).ellipse([P(x0), P(y0), P(x1), P(y1)], outline=255, width=max(1, P(w)))
    def arc(s, box, a0, a1, w=0.8, light=False):
        x0, y0, x1, y1 = box
        (s.dh if light else s.dm).arc([P(x0), P(y0), P(x1), P(y1)], a0, a1, fill=255, width=max(1, P(w)))
    def dot(s, x, y, r):
        s.dm.ellipse([P(x - r), P(y - r), P(x + r), P(y + r)], fill=255)
    def hatch(s, region, angle=45, gap=1.6, w=0.45):
        """Light parallel hatching clipped to a polygon (list of pts) or a mask."""
        W, H = s.main.size
        if isinstance(region, Image.Image): clip = region
        else:
            clip = Image.new("L", (W, H), 0)
            ImageDraw.Draw(clip).polygon([(P(x), P(y)) for x, y in region], fill=255)
        lay = Image.new("L", (W, H), 0); dl = ImageDraw.Draw(lay)
        a = math.radians(angle); dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
        diag = math.hypot(CW, CH)
        for k in np.arange(-diag, diag, gap):
            cx, cy = CW / 2 + nx * k, CH / 2 + ny * k
            dl.line([(P(cx - dx * diag), P(cy - dy * diag)), (P(cx + dx * diag), P(cy + dy * diag))], fill=255, width=max(1, P(w)))
        s.hat = ImageChops.lighter(s.hat, ImageChops.multiply(lay, clip)); s.dh = ImageDraw.Draw(s.hat)
    def erase(s, pts):
        for m in (s.main, s.hat):
            ImageDraw.Draw(m).polygon([(P(x), P(y)) for x, y in pts], fill=0)


def palm(p, x0, y0, x1, y1, size=13, fronds=8, seed=0, lean=1):
    """Trunk from (x0,y0) ground to crown (x1,y1), with ringed trunk and leafleted fronds."""
    rng = np.random.default_rng(seed)
    t = np.linspace(0, 1, 30)
    bx = x0 + (x1 - x0) * t + lean * 3 * np.sin(t * math.pi) ; by = y0 + (y1 - y0) * t
    p.line(list(zip(bx - 0.7, by)), 0.6); p.line(list(zip(bx + 0.7, by)), 0.6)
    for i in range(2, 30, 2): p.line([(bx[i] - 0.7, by[i]), (bx[i] + 0.7, by[i] - 0.4)], 0.35, light=True)
    for f in range(fronds):
        ang = math.radians(-170 + 340 * f / (fronds - 1) * 0.5 + rng.uniform(-8, 8)) if fronds > 1 else 0
        ang = math.radians([-175, -140, -110, -75, -40, -10, 20, 200][f % 8] + rng.uniform(-6, 6))
        L = size * rng.uniform(0.8, 1.05)
        pts = []
        for u in np.linspace(0, 1, 16):
            r = L * u
            pts.append((x1 + r * math.cos(ang), y1 + r * math.sin(ang) + 0.32 * L * u * u))
        p.line(pts, 0.55)
        for j in range(3, 15, 2):
            (xa, ya), (xb, yb) = pts[j - 1], pts[j + 1]
            tx, ty = xb - xa, yb - ya; n = math.hypot(tx, ty) or 1
            nx, ny = -ty / n, tx / n
            ll = 2.6 * (1 - j / 16) + 0.6
            for sgn in (1, -1):
                p.line([pts[j], (pts[j][0] + sgn * nx * ll + tx / n * 0.8, pts[j][1] + sgn * ny * ll + 1.2)], 0.3, light=True)
    p.dot(x1 + 1, y1 + 1.5, 0.9); p.dot(x1 - 1.2, y1 + 1.8, 0.8)


def water(p, x0, x1, ys, seed=1):
    rng = np.random.default_rng(seed)
    for i, y in enumerate(ys):
        x = x0 + rng.uniform(0, 4)
        while x < x1:
            ln = rng.uniform(4, 11)
            p.line([(x + u, y + 0.5 * math.sin(u * 1.4)) for u in np.arange(0, ln, 0.5)], 0.4, light=i > 0)
            x += ln + rng.uniform(2, 5)


def windows(p, x0, x1, y0, y1, cols, rows):
    for i in range(1, cols): p.line([(x0 + (x1 - x0) * i / cols, y0), (x0 + (x1 - x0) * i / cols, y1)], 0.3, light=True)
    for j in range(1, rows): p.line([(x0, y0 + (y1 - y0) * j / rows), (x1, y0 + (y1 - y0) * j / rows)], 0.3, light=True)


def sk_BNA(p):
    # Nashville: AT&T "Batman" tower, Pinnacle, neighbours, Cumberland river
    b = [(196, GY), (196, 64), (208, 64), (208, GY)]; p.poly(b, 0.6); windows(p, 196, 208, 64, GY, 3, 4)
    b = [(210, GY), (210, 58), (226, 58), (226, GY)]; p.poly(b, 0.6); windows(p, 210, 226, 58, GY, 4, 6)
    # Pinnacle with stepped crown
    pin = [(230, GY), (230, 46), (233, 46), (233, 42), (237, 42), (237, 37), (243, 37), (243, 42), (247, 42), (247, 46), (250, 46), (250, GY)]
    p.poly(pin, 0.7); windows(p, 230, 250, 46, GY, 5, 9); p.line([(240, 37), (240, 32)], 0.5)
    b = [(253, GY), (253, 52), (268, 52), (268, GY)]; p.poly(b, 0.6); p.hatch(b, 90, 1.5)
    # Batman tower
    cx = 288
    bat = [(cx - 13, GY), (cx - 13, 40), (cx - 10, 36), (cx - 10, 30), (cx - 8.6, 30), (cx - 7.5, 15), (cx - 6.4, 30),
           (cx - 3.5, 30), (cx, 25), (cx + 3.5, 30), (cx + 6.4, 30), (cx + 7.5, 15), (cx + 8.6, 30), (cx + 10, 30),
           (cx + 10, 36), (cx + 13, 40), (cx + 13, GY)]
    p.poly(bat, 0.8)
    p.line([(cx - 10, 36), (cx + 10, 36)], 0.5); p.line([(cx - 13, 40), (cx + 13, 40)], 0.5)
    for x in np.arange(cx - 11, cx + 12, 2.2): p.line([(x, 41), (x, GY)], 0.3, light=True)
    p.hatch([(cx + 4, 41), (cx + 13, 41), (cx + 13, GY), (cx + 4, GY)], 60, 1.3)   # shaded side
    p.line([(cx, 25), (cx, 21)], 0.4)
    b = [(304, GY), (304, 50), (316, 50), (316, GY)]; p.poly(b, 0.6); windows(p, 304, 316, 50, GY, 3, 7)
    b = [(318, GY), (318, 58), (322, 54), (334, 54), (334, GY)]; p.poly(b, 0.6); p.hatch(b, 90, 1.6)
    b = [(336, GY), (336, 62), (348, 62), (348, GY)]; p.poly(b, 0.6); windows(p, 336, 348, 62, GY, 3, 3)
    p.line([(192, GY), (350, GY)], 0.6)
    water(p, 194, 350, [75.5, 78], seed=4)


def sk_MIA(p):
    # Miami Beach: an Art Deco hotel with a central fin, two palms, surf
    x0, x1, top = 248, 304, 47
    body = [(x0 + 5, GY), (x0 + 5, top), (x1, top), (x1, GY)]
    p.line([(x1, GY), (x1, top), (x0 + 5, top)], 0.7)
    p.arc([x0, top, x0 + 10, top + 10], 180, 270, 0.7); p.line([(x0, top + 5), (x0, GY)], 0.7)
    for y in (53, 60, 67):   # eyebrow ledges with their shadows
        p.line([(x0 - 1, y), (x1 + 1.5, y)], 0.6)
        p.hatch([(x0, y + 0.4), (x1, y + 0.4), (x1, y + 2.2), (x0, y + 2.2)], 0, 0.7, 0.3)
    for y in (49.5, 56.5, 63.5, 70):
        for x in np.arange(x0 + 3, x1 - 2, 5.5):
            if 270 < x < 282: continue
            p.line([(x, y - 1.2), (x + 2.6, y - 1.2), (x + 2.6, y + 0.8), (x, y + 0.8), (x, y - 1.2)], 0.3, light=True)
    fin = [(271, top), (271, 31), (273, 31), (273, 27), (275, 27), (275, 22), (277, 22), (277, 27), (279, 27), (279, 31), (281, 31), (281, top)]
    p.line(fin, 0.7)
    for y in np.arange(33, top, 2.2): p.line([(272.5, y), (279.5, y)], 0.3, light=True)
    p.hatch([(276, 31), (281, 31), (281, top), (276, top)], 70, 1.2)
    p.line([(276, 22), (276, 18)], 0.4)
    palm(p, 226, GY, 222, 40, size=14, seed=2, lean=-1)
    palm(p, 322, GY, 326, 42, size=13, seed=5, lean=1)
    palm(p, 342, GY, 340, 52, size=9, seed=8, lean=1)
    p.line([(194, GY), (350, GY)], 0.5)
    water(p, 194, 350, [75.5, 78], seed=7)


def sk_DEN(p):
    # Denver: the airport's tent roof in front of the Front Range, pines
    ridge = [(190, 60), (204, 50), (212, 54), (226, 38), (236, 46), (246, 40), (262, 26), (274, 38), (284, 33),
             (298, 22), (312, 36), (322, 31), (336, 44), (350, 40)]
    p.line(ridge, 0.7)
    for i in range(1, len(ridge) - 1):   # shade the right slope of each peak
        (xa, ya), (xb, yb) = ridge[i], ridge[i + 1]
        if yb > ya:
            p.hatch([(xa, ya), (xb, yb), (xb, 64), (xa + 2, 64)], 60, 1.5)
    for pk in (3, 6, 9, 11):   # snow lines under the highest peaks
        x, y = ridge[pk]
        p.line([(x - 6, y + 6), (x - 3, y + 4.5), (x - 1, y + 6.5), (x + 2, y + 4), (x + 5, y + 6.5)], 0.45)
    # tent roof terminal
    peaks = [256, 268, 280, 292, 304, 316, 328]
    roof = [(246, 70)]
    for i, x in enumerate(peaks):
        roof.append((x, 54))
        if i < len(peaks) - 1:
            for u in np.linspace(0.15, 0.85, 7):
                roof.append((x + 12 * u, 54 + 7 * math.sin(math.pi * u)))
    roof.append((338, 70))
    p.erase(roof + [(338, GY), (246, GY)])
    p.line(roof, 0.75)
    for x in peaks:
        p.line([(x, 54), (x, 49.5)], 0.45); p.line([(x, 49.5), (x - 4, 56)], 0.3, light=True); p.line([(x, 49.5), (x + 4, 56)], 0.3, light=True)
    p.line([(244, 70), (340, 70)], 0.6)
    for x in np.arange(246, 339, 2.4): p.line([(x, 70), (x, GY)], 0.3, light=True)
    for i, x in enumerate(peaks[:-1]):   # soft fabric shading under each scallop
        p.hatch([(x + 2, 57), (x + 10, 57), (x + 9, 69), (x + 3, 69)], 90, 1.4, 0.3)
    for x, h in ((200, 13), (209, 17), (218, 12), (230, 15), (346, 11)):   # pines
        for k in range(3):
            yy = GY - h + k * h / 3.2
            w = 2.2 + k * 1.5
            p.line([(x - w, yy + h / 3), (x, yy), (x + w, yy + h / 3)], 0.5)
        p.line([(x, GY - 2), (x, GY)], 0.5)
    p.line([(190, GY), (350, GY)], 0.6)


def sk_LAX(p):
    # Los Angeles: LAX Theme Building between tall, thin palms, beams of light
    cx, sy = 288, 36
    p.ell([cx - 26, sy - 4.5, cx + 26, sy + 4.5], 0.8)
    p.ell([cx - 20, sy - 2.8, cx + 20, sy + 2.8], 0.4, light=True)
    p.arc([cx - 9, sy - 9, cx + 9, sy + 4], 180, 360, 0.6)
    for x in np.arange(cx - 7, cx + 8, 2.2): p.line([(x, sy - 3.5), (x, sy - 1.2)], 0.3, light=True)
    p.hatch([(cx - 24, sy + 1), (cx + 24, sy + 1), (cx + 18, sy + 4.4), (cx - 18, sy + 4.4)], 0, 0.8, 0.3)
    p.line([(cx - 3, sy + 4.5), (cx - 3, 52)], 0.5); p.line([(cx + 3, sy + 4.5), (cx + 3, 52)], 0.5)
    p.line([(cx - 3, 52), (cx + 3, 52)], 0.5)
    t = np.linspace(0, 1, 30)
    for sgn in (-1, 1):   # four parabolic legs, front pair doubled and shaded
        o = [(cx + sgn * (5 + 33 * u ** 1.7), sy + 3 + (GY - sy - 3) * u) for u in t]
        i_ = [(cx + sgn * (5 + 28 * u ** 1.9), sy + 3 + (GY - sy - 3) * u) for u in t]
        p.line(o, 0.75); p.line(i_, 0.55)
        p.hatch(o + i_[::-1], 30 if sgn > 0 else 150, 1.1, 0.3)
        back = [(cx + sgn * (2 + 15 * u ** 1.5), sy + 4 + (GY - sy - 4) * u) for u in t]
        p.line(back, 0.45)
    p.line([(cx - 40, GY), (cx + 40, GY)], 0.6)
    palm(p, 232, GY, 230, 44, size=9, fronds=8, seed=11, lean=-1)
    palm(p, 246, GY, 247, 50, size=7, fronds=8, seed=12, lean=1)
    palm(p, 338, GY, 340, 42, size=8, fronds=8, seed=13, lean=1)
    p.line([(196, GY), (350, GY)], 0.5)
    for y in (75.5, 78): p.line([(200 + (y - 75) * 6, y), (346 - (y - 75) * 6, y)], 0.35, light=True)


def tower(p, x0, x1, top, cols=0, rows=0, hatch_side=False, w=0.6):
    b = [(x0, GY), (x0, top), (x1, top), (x1, GY)]
    p.poly(b, w)
    if cols or rows: windows(p, x0, x1, top, GY, max(cols, 1), max(rows, 1))
    if hatch_side: p.hatch([((x0 + x1) / 2 + 2, top), (x1, top), (x1, GY), ((x0 + x1) / 2 + 2, GY)], 60, 1.4)


def tree_round(p, x, y, r):
    pts = []
    for a in np.linspace(math.pi, 2 * math.pi + math.pi, 40):
        rr = r * (1 + 0.12 * math.sin(a * 5))
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a) * 0.85))
    p.line(pts, 0.5); p.line([(x, y + r * 0.6), (x, GY)], 0.5)
    p.hatch([(x, y - r), (x + r, y - r), (x + r, y + r), (x, y + r)], 60, 1.5, 0.3)


def pine(p, x, h):
    for k in range(3):
        yy = GY - h + k * h / 3.2; w = 2.2 + k * 1.5
        p.line([(x - w, yy + h / 3), (x, yy), (x + w, yy + h / 3)], 0.5)
    p.line([(x, GY - 2), (x, GY)], 0.5)


def saguaro(p, x, h, arms):
    top = GY - h
    p.line([(x - 2.2, GY), (x - 2.2, top + 2.2)], 0.6); p.line([(x + 2.2, GY), (x + 2.2, top + 2.2)], 0.6)
    p.arc([x - 2.2, top, x + 2.2, top + 4.4], 180, 360, 0.6)
    p.line([(x, top + 2), (x, GY)], 0.3, light=True)
    for side, ay, ah in arms:
        s = side
        x0 = x + s * 2.2; xe = x + s * 6.5
        p.line([(x0, ay), (xe - s * 1.6, ay), ], 0.55)
        p.arc([min(xe - s * 3.2, xe), ay - 3.2, max(xe - s * 3.2, xe), ay + 3.2], 0 if s > 0 else 90, 90 if s > 0 else 180, 0.55)
        p.line([(xe, ay), (xe, ay - ah)], 0.55)
        p.line([(x0, ay + 3.4), (xe - s * 3.5, ay + 3.4)], 0.55)
        p.line([(xe - s * 3.5, ay + 3.4), (xe - s * 3.5 + s * 0.01, ay - ah)], 0.0001)
        p.line([(xe - s * 3.2, ay), (xe - s * 3.2, ay - ah)], 0.55)
        p.arc([min(xe, xe - s * 3.2), ay - ah - 1.6, max(xe, xe - s * 3.2), ay - ah + 1.6], 180, 360, 0.55)
    p.hatch([(x + 0.5, top + 2), (x + 2.2, top + 2), (x + 2.2, GY), (x + 0.5, GY)], 90, 0.9, 0.3)


def sk_ATL(p):
    for x, y, r in ((200, 62, 6), (212, 60, 7), (226, 63, 6), (238, 61, 5.5)):
        tree_round(p, x, y, r)
    tower(p, 244, 254, 54, 3, 6)
    # Westin Peachtree Plaza: a glass cylinder
    p.line([(256, GY), (256, 38)], 0.7); p.line([(270, GY), (270, 38)], 0.7)
    p.arc([256, 35, 270, 41], 180, 360, 0.7); p.arc([256, 35, 270, 41], 0, 180, 0.5)
    for y in np.arange(43, GY, 2.6): p.arc([256, y - 1.5, 270, y + 1.5], 0, 180, 0.3, light=True)
    p.hatch([(265, 38), (270, 38), (270, GY), (265, GY)], 90, 1.0)
    tower(p, 274, 284, 48, 3, 7)
    # Bank of America Plaza: lattice pyramid crown and spire
    cx = 297
    p.poly([(cx - 8, GY), (cx - 8, 34), (cx + 8, 34), (cx + 8, GY)], 0.8)
    for y in (42, 50): p.line([(cx - 8, y), (cx + 8, y)], 0.4)
    for x in np.arange(cx - 6, cx + 7, 2.2): p.line([(x, 35), (x, GY)], 0.3, light=True)
    p.hatch([(cx + 2, 35), (cx + 8, 35), (cx + 8, GY), (cx + 2, GY)], 60, 1.3)
    crown = [(cx - 8, 34), (cx, 21), (cx + 8, 34)]
    p.line(crown, 0.7)
    p.hatch(crown, 45, 1.6, 0.35); p.hatch(crown, 135, 1.6, 0.35)
    p.line([(cx, 21), (cx, 12)], 0.5)
    tower(p, 309, 321, 50, 3, 6, hatch_side=True)
    tower(p, 323, 337, 58, 4, 4)
    tower(p, 339, 349, 64, 2, 2)
    p.line([(192, GY), (350, GY)], 0.6)


def sk_CLT(p):
    # a little checkered flag for the speedway
    p.line([(204, GY), (204, 50)], 0.5)
    for i in range(4):
        for j in range(3):
            x0 = 204 + i * 3.2; y0 = 50 + j * 3.2 + 0.8 * math.sin(i * 0.9)
            box = [(x0, y0), (x0 + 3.2, y0 + 0.7), (x0 + 3.2, y0 + 3.9), (x0, y0 + 3.2)]
            p.poly(box, 0.3)
            if (i + j) % 2 == 0: p.hatch(box, 45, 0.6, 0.35)
    tower(p, 222, 236, 62, 3, 3)
    # Truist Center: stepped pyramid top
    p.line([(242, GY), (242, 46), (245, 46), (245, 42), (248, 42), (248, 38), (252, 38), (252, 42), (255, 42), (255, 46), (258, 46), (258, GY)], 0.7)
    windows(p, 242, 258, 46, GY, 4, 8)
    tower(p, 262, 274, 52, 3, 6)
    # Bank of America Corporate Center: crown of rods
    cx = 288
    p.line([(cx - 9, GY), (cx - 9, 40), (cx - 7, 34)], 0.8); p.line([(cx + 9, GY), (cx + 9, 40), (cx + 7, 34)], 0.8)
    p.line([(cx - 7, 34), (cx + 7, 34)], 0.6)
    for x in np.arange(cx - 6.5, cx + 7, 1.3):
        h = 22 + 9 * ((x - cx) / 7) ** 2
        p.line([(x, 34), (x, h)], 0.35)
    for x in np.arange(cx - 7, cx + 8, 2.3): p.line([(x, 41), (x, GY)], 0.3, light=True)
    p.hatch([(cx + 3, 40), (cx + 9, 40), (cx + 9, GY), (cx + 3, GY)], 60, 1.3)
    # Duke Energy Center: slanted top
    p.poly([(304, GY), (304, 40), (318, 34), (318, GY)], 0.7); windows(p, 304, 318, 41, GY, 3, 8)
    tower(p, 322, 334, 54, 3, 5, hatch_side=True)
    tower(p, 336, 348, 62, 3, 3)
    p.line([(194, GY), (350, GY)], 0.6)


def sk_DAL(p):
    # Margaret Hunt Hill Bridge in front, Fountain Place, Reunion Tower, Bank of America Plaza
    deck = 69
    p.line([(194, deck), (244, deck)], 0.6)
    arch = [(200 + 38 * u, deck - 22 * math.sin(math.pi * u)) for u in np.linspace(0, 1, 40)]
    p.line(arch, 0.7)
    for u in np.linspace(0.12, 0.88, 11):
        ax, ay = 200 + 38 * u, deck - 22 * math.sin(math.pi * u)
        p.line([(ax, ay), (ax + (u - 0.5) * 10, deck)], 0.3, light=True)
    for y in (71.5,): p.line([(194, y), (244, y)], 0.3, light=True)
    # Fountain Place prism
    p.poly([(256, GY), (256, 40), (265, 25), (274, 36), (274, GY)], 0.75)
    p.line([(265, 25), (265, GY)], 0.45); p.line([(256, 40), (265, 48)], 0.35); p.line([(274, 36), (265, 48)], 0.35)
    p.hatch([(265, 25), (274, 36), (274, GY), (265, GY)], 60, 1.4)
    tower(p, 278, 288, 52, 3, 6)
    # Reunion Tower
    cx, cy = 302, 29
    for x in (cx - 2.2, cx, cx + 2.2): p.line([(x, cy + 8), (x, GY)], 0.5)
    p.line([(cx - 5, GY), (cx - 2.2, GY - 6)], 0.4); p.line([(cx + 5, GY), (cx + 2.2, GY - 6)], 0.4)
    p.ell([cx - 8, cy - 8, cx + 8, cy + 8], 0.75)
    for k in (-5, 0, 5): p.ell([cx - 8 * math.sqrt(1 - (k / 8) ** 2), cy + k - 1.2, cx + 8 * math.sqrt(1 - (k / 8) ** 2), cy + k + 1.2], 0.3, light=True)
    for k in (3, 6): p.ell([cx - k, cy - 8, cx + k, cy + 8], 0.3, light=True)
    p.line([(cx - 8.5, cy + 3), (cx + 8.5, cy + 3)], 0.4)
    p.line([(cx, cy - 8), (cx, cy - 12)], 0.4)
    # Bank of America Plaza, outlined twice like its lights
    p.poly([(316, GY), (316, 34), (330, 34), (330, GY)], 0.7); p.poly([(317.4, GY), (317.4, 35.4), (328.6, 35.4), (328.6, GY)], 0.35)
    windows(p, 317.4, 328.6, 35.4, GY, 4, 10)
    tower(p, 334, 348, 56, 3, 4, hatch_side=True)
    p.line([(246, GY), (350, GY)], 0.6)


def sk_DFW(p):
    # DFW: control tower, a terminal with jet bridges, a plane on approach
    plane = [(214, 43), (238, 46.5), (241, 47.5), (238, 48.5), (214, 47)]
    p.poly(plane, 0.55)
    p.line([(224, 45), (230, 38.5), (232.5, 38.5), (229, 46)], 0.5)
    p.line([(224, 47.2), (229, 52), (231.5, 52), (229, 47.6)], 0.4)
    p.line([(215, 44), (213, 39.5), (216, 39.5), (219, 44)], 0.45)
    for x in np.arange(228, 239, 2.2): p.dot(x, 46.2, 0.25)
    p.line([(194, 40), (211, 42.6)], 0.3, light=True)
    # terminal
    p.line([(244, GY), (244, 64)], 0.6)
    p.line([(244 + u, 64 - 3 * math.sin(math.pi * u / 104)) for u in np.arange(0, 105, 1)], 0.7)
    p.line([(348, 64), (348, GY)], 0.6)
    for x in np.arange(247, 347, 2.6): p.line([(x, 64.5 - 2.8 * math.sin(math.pi * (x - 244) / 104)), (x, GY - 3)], 0.3, light=True)
    p.line([(244, GY - 3), (348, GY - 3)], 0.4)
    for x in (256, 270, 322, 336): p.line([(x, GY - 3), (x - 4, GY)], 0.35)
    # control tower
    cx = 296
    p.line([(cx - 4, 61), (cx - 3, 36)], 0.7); p.line([(cx + 4, 61), (cx + 3, 36)], 0.7)
    for y in np.arange(39, 61, 3): p.line([(cx - 3.3, y), (cx + 3.3, y)], 0.3, light=True)
    p.hatch([(cx, 36), (cx + 3, 36), (cx + 4, 61), (cx, 61)], 60, 1.2)
    cab = [(cx - 9, 36), (cx - 10.5, 28), (cx + 10.5, 28), (cx + 9, 36)]
    p.poly(cab, 0.75)
    for x in np.arange(cx - 8, cx + 9, 2.6): p.line([(x, 29), (x * 0.98 + cx * 0.02, 35)], 0.3, light=True)
    p.line([(cx - 10.5, 28), (cx - 8, 25.5), (cx + 8, 25.5), (cx + 10.5, 28)], 0.6)
    p.line([(cx, 25.5), (cx, 17)], 0.45); p.line([(cx - 3, 20), (cx + 3, 20)], 0.3)
    p.line([(192, GY), (350, GY)], 0.6)
    for x in np.arange(198, 240, 5): p.dot(x, 75.5, 0.45)


def sk_LGA(p):
    tower(p, 198, 214, 62, 4, 3)
    tower(p, 226, 244, 54, 4, 6, hatch_side=True)
    # Chrysler Building crown
    cx = 259
    p.poly([(cx - 7, GY), (cx - 7, 40), (cx + 7, 40), (cx + 7, GY)], 0.75)
    windows(p, cx - 7, cx + 7, 40, GY, 4, 10)
    for k, (w, y) in enumerate(((7, 40), (5.5, 36.5), (4, 33), (2.6, 29.5))):
        p.arc([cx - w, y - w, cx + w, y + w], 180, 360, 0.55)
        for a in np.linspace(200, 340, 5): p.line([(cx + w * 0.55 * math.cos(math.radians(a)), y + w * 0.55 * math.sin(math.radians(a))),
                                                 (cx + w * 0.85 * math.cos(math.radians(a)), y + w * 0.85 * math.sin(math.radians(a)))], 0.3, light=True)
    p.line([(cx, 27), (cx, 15)], 0.45)
    tower(p, 270, 282, 48, 3, 6)
    # Empire State Building setbacks
    cx = 300
    steps = [(12, 52), (9, 44), (6, 37), (4, 31), (2.5, 25), (1.4, 21)]
    prev = None
    for w, y in steps:
        p.line([(cx - w, prev if prev else GY), (cx - w, y), (cx + w, y), (cx + w, prev if prev else GY)], 0.7)
        prev = y
    p.line([(cx, 21), (cx, 11)], 0.45)
    for x in np.arange(cx - 8, cx + 9, 2): p.line([(x, 45), (x, GY)], 0.3, light=True)
    p.hatch([(cx + 2, 31), (cx + 12, 31), (cx + 12, GY), (cx + 2, GY)], 60, 1.4)
    tower(p, 316, 330, 50, 3, 7)
    tower(p, 332, 348, 60, 4, 4, hatch_side=True)
    p.line([(194, GY), (350, GY)], 0.6)
    water(p, 194, 350, [75.5, 78], seed=21)


def sk_ORD(p):
    tower(p, 200, 214, 60, 3, 4)
    tower(p, 216, 232, 54, 4, 6)
    # John Hancock: tapered with X bracing
    xl0, xr0, xl1, xr1, top = 240, 260, 243, 257, 30
    p.line([(xl0, GY), (xl1, top), (xr1, top), (xr0, GY)], 0.75)
    segs = 5
    for i in range(segs):
        y0 = top + (GY - top) * i / segs; y1 = top + (GY - top) * (i + 1) / segs
        a0 = xl1 + (xl0 - xl1) * (y0 - top) / (GY - top); b0 = xr1 + (xr0 - xr1) * (y0 - top) / (GY - top)
        a1 = xl1 + (xl0 - xl1) * (y1 - top) / (GY - top); b1 = xr1 + (xr0 - xr1) * (y1 - top) / (GY - top)
        p.line([(a0, y0), (b1, y1)], 0.4); p.line([(b0, y0), (a1, y1)], 0.4); p.line([(a1, y1), (b1, y1)], 0.35)
    p.line([(247, top), (247, 19)], 0.4); p.line([(253, top), (253, 21)], 0.4)
    tower(p, 266, 278, 50, 3, 6)
    # Willis Tower: bundled tubes, two antennas
    for (x0, x1, t) in ((284, 291, 48), (291, 298, 28), (298, 305, 38), (305, 312, 56)):
        p.line([(x0, GY), (x0, t), (x1, t), (x1, GY)], 0.7)
    for y in (44, 58, 66): p.line([(284, y), (312, y)], 0.35)
    for x in np.arange(285.5, 312, 1.8): p.line([(x, 45), (x, GY)], 0.3, light=True)
    p.hatch([(298, 38), (312, 38), (312, GY), (298, GY)], 60, 1.4)
    p.line([(293.5, 28), (293.5, 15)], 0.45); p.line([(296, 28), (296, 17)], 0.45)
    tower(p, 318, 332, 52, 3, 7, hatch_side=True)
    tower(p, 334, 348, 62, 3, 3)
    p.line([(194, GY), (350, GY)], 0.6)
    water(p, 194, 350, [75.5, 78], seed=31)


def sk_PHX(p):
    mtn = [(226, GY - 6), (238, 58), (248, 52), (256, 46), (262, 40), (268, 43), (274, 49), (284, 47), (292, 40), (300, 36),
           (308, 42), (318, 54), (330, 60), (346, GY - 5)]
    sun_c, sun_r = (282, 40), 8
    p.ell([sun_c[0] - sun_r, sun_c[1] - sun_r, sun_c[0] + sun_r, sun_c[1] + sun_r], 0.5)
    for a in np.arange(180, 361, 22.5):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        p.line([(sun_c[0] + ca * 10.5, sun_c[1] + sa * 10.5), (sun_c[0] + ca * 13, sun_c[1] + sa * 13)], 0.35, light=True)
    p.erase(mtn + [(346, GY), (226, GY)])
    p.line(mtn, 0.75)
    for i in range(len(mtn) - 1):
        (xa, ya), (xb, yb) = mtn[i], mtn[i + 1]
        if yb > ya: p.hatch([(xa, ya), (xb, yb), (xb, GY - 4), (xa + 1, GY - 4)], 60, 1.5)
    p.line([(268, 43), (270, 47), (274, 49)], 0.35)
    p.erase([(296, 30), (310, 30), (310, GY), (296, GY)])
    p.erase([(206, 40), (222, 40), (222, GY), (206, GY)])
    p.erase([(334, 50), (346, 50), (346, GY), (334, GY)])
    saguaro(p, 303, 38, [(-1, 56, 8), (1, 50, 9)])
    saguaro(p, 214, 28, [(1, 60, 7)])
    saguaro(p, 340, 18, [(-1, 65, 5)])
    for x in (234, 252, 262, 324): p.line([(x - 2, GY), (x, GY - 2.5), (x + 2, GY)], 0.35)
    p.line([(194, GY), (350, GY)], 0.6)
    for x in np.arange(200, 348, 7): p.dot(x + (x * 7) % 3, 75.5 + (x % 2), 0.3)


def sk_SEA(p):
    # Mount Rainier behind, the Space Needle, evergreens, Elliott Bay
    mt = [(196, 66), (214, 56), (226, 46), (236, 38), (242, 36), (250, 39), (262, 47), (280, 56), (300, 62), (330, 66)]
    p.line(mt, 0.6)
    p.line([(228, 44.5), (231, 46), (234, 43), (237, 46.5), (240, 43.5), (244, 46), (248, 42.5), (252, 44.5), (256, 43.5)], 0.4)
    p.hatch([(242, 36), (250, 39), (262, 47), (280, 56), (300, 62), (300, 66), (242, 66)], 60, 1.7)
    cx = 304
    p.erase([(cx - 16, 20), (cx + 16, 20), (cx + 16, GY), (cx - 16, GY)])
    for s in (-1, 1):
        p.line([(cx + s * (2 + 7 * (1 - u) ** 1.5), 50 + (GY - 50) * (1 - u)) for u in np.linspace(0, 1, 20)], 0.6)
        p.line([(cx + s * (2 + 7 * u ** 1.2), 50 - 18 * u) for u in np.linspace(0, 1, 16)], 0.6)
    p.line([(cx - 2, 50), (cx + 2, 50)], 0.5)
    p.line([(cx, GY), (cx, 34)], 0.45)
    p.line([(cx - 12, 30), (cx + 12, 30)], 0.4)
    p.ell([cx - 14, 28, cx + 14, 33], 0.75)
    p.ell([cx - 9, 25, cx + 9, 30], 0.5)
    p.arc([cx - 5, 21, cx + 5, 27], 180, 360, 0.5)
    for x in np.arange(cx - 12, cx + 13, 2): p.line([(x, 30.5), (x, 32)], 0.3, light=True)
    p.line([(cx, 21), (cx, 10)], 0.45)
    for x, h in ((200, 14), (208, 18), (217, 12), (330, 16), (338, 20), (346, 13)): pine(p, x, h)
    p.line([(194, GY), (350, GY)], 0.6)
    water(p, 194, 350, [75.5, 78], seed=41)


SKETCH = dict(ATL=sk_ATL, BNA=sk_BNA, CLT=sk_CLT, DAL=sk_DAL, DEN=sk_DEN, DFW=sk_DFW, LAX=sk_LAX, LGA=sk_LGA,
              MIA=sk_MIA, ORD=sk_ORD, PHX=sk_PHX, SEA=sk_SEA)

# The sketch box on the ticket, in points of a 360 pt card: it hugs the right edge, above the perforation.
BX0, BX1, BY0, BY1 = 186, 352, 6, DIV_Y - 4


def export_png(code, path):
    W, H = P(CW), P(CH)
    p = Pen(W, H)
    SKETCH[code](p)
    m = ImageChops.lighter(p.main, p.hat.point(lambda v: v * 0.6))
    xs = np.arange(W) / K
    ramp = np.clip((xs - 186) / 40, 0, 1)
    a = np.asarray(m, dtype=np.float32) * ramp[None, :]
    m = Image.fromarray(a.astype(np.uint8)).crop((P(BX0), P(BY0), P(BX1), P(BY1)))
    m = m.resize((round((BX1 - BX0) * 3), round((BY1 - BY0) * 3)), Image.LANCZOS)
    img = Image.new("RGBA", m.size, (255, 255, 255, 0)); img.putalpha(m)
    img.save(path, optimize=True)


FIPS = {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
        "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
        "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
        "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
        "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
        "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR"}


def load_states(path="node_modules/us-atlas/states-10m.json"):
    """Each state's rings in lon/lat, from the us-atlas topology the globe already uses (Census boundaries)."""
    import json
    t = json.load(open(path))
    (sx, sy), (tx, ty) = t["transform"]["scale"], t["transform"]["translate"]
    arcs = []
    for arc in t["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(ids):
        out = []
        for i in ids:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(a if not out else a[1:])
        return out
    states = {}
    for g in t["objects"]["states"]["geometries"]:
        code = FIPS.get(g["id"])
        if not code: continue
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        rings = [ring(poly[0]) for poly in polys]  # outer rings only
        if code == "AK":  # the Aleutians cross the date line
            rings = [[(lo - 360 if lo > 0 else lo, la) for lo, la in r] for r in rings]
        states[code] = rings
    return states


def state_frame(rings):
    """How a state's lon/lat maps onto the sketch box: about 80 x 50 pt, centered at x 300, standing on the ground line."""
    lon = [x for r in rings for x, _ in r]; lat = [y for r in rings for _, y in r]
    k = math.cos(math.radians((min(lat) + max(lat)) / 2))
    w, h = (max(lon) - min(lon)) * k, max(lat) - min(lat)
    s = min(80 / w, 50 / h)
    return dict(lonMin=min(lon), latMax=max(lat), k=k, s=s, ox=300 - w * s / 2, oy=GY - 1 - h * s)


def sk_state(p, rings, f):
    for r in rings:
        pts = [(f["ox"] + (lo - f["lonMin"]) * f["k"] * f["s"], f["oy"] + (f["latMax"] - la) * f["s"]) for lo, la in r]
        if len(pts) < 3: continue
        xs = [x for x, _ in pts]; ys = [y for _, y in pts]
        if max(xs) - min(xs) < 0.8 and max(ys) - min(ys) < 0.8: continue  # specks of islands
        p.poly(pts, 0.75)
        p.hatch(pts, 45, 2.0, 0.35)


def write_ts(landmarks, frames):
    """src/ui/sketchAssets.ts: the images and each state's frame, so the app can place an airport's circle."""
    L = ["// Made by design/landmark-sketches.py (round 221). Don't edit by hand; run the script again.",
         "/* eslint-disable @typescript-eslint/no-require-imports */", "",
         "/** The sketch box on a results ticket, in points, at its right edge above the perforation. */",
         f"export const SKETCH_W = {BX1 - BX0};", f"export const SKETCH_H = {BY1 - BY0};",
         f"/** Where the box starts on the 360 pt card the sketches were drawn on (for placing a state's circle). */",
         f"export const SKETCH_X0 = {BX0};", f"export const SKETCH_Y0 = {BY0};", "",
         "/** A landmark for every airport in the app (round 221, John). */",
         "export const LANDMARK_IMAGES: Readonly<Record<string, number>> = {"]
    L += [f"  {c}: require('../../assets/images/landmarks/{c.lower()}.png')," for c in landmarks]
    L += ["};", "", "/** A state's outline, for a US airport with no landmark of its own yet. */",
          "export const STATE_IMAGES: Readonly<Record<string, number>> = {"]
    L += [f"  {c}: require('../../assets/images/states/{c.lower()}.png')," for c in sorted(frames)]
    L += ["};", "", "export interface StateFrame {", "  lonMin: number;", "  latMax: number;", "  k: number;", "  s: number;",
          "  ox: number;", "  oy: number;", "}", "",
          "/** How each state's lon/lat maps onto the 360 pt card the outline was drawn on. */",
          "export const STATE_FRAMES: Readonly<Record<string, StateFrame>> = {"]
    for c in sorted(frames):
        f = frames[c]
        L.append(f"  {c}: {{ lonMin: {f['lonMin']}, latMax: {f['latMax']}, k: {f['k']}, s: {f['s']}, ox: {f['ox']}, oy: {f['oy']} }},")
    L += ["};", ""]
    open(os.path.join("src", "ui", "sketchAssets.ts"), "w").write("\n".join(L))


if __name__ == "__main__":
    import json
    out = os.path.join("assets", "images", "states")
    os.makedirs(out, exist_ok=True)
    frames = {}
    for code, rings in sorted(load_states().items()):
        f = state_frame(rings)
        SKETCH["_state"] = lambda p, rings=rings, f=f: sk_state(p, rings, f)
        export_png("_state", os.path.join(out, f"{code.lower()}.png"))
        # where the airport's circle goes: box points = (lon - lonMin) * k * s + ox - BX0, (latMax - lat) * s + oy - BY0
        frames[code] = {key: round(v, 5) for key, v in f.items()}
    del SKETCH["_state"]
    print("wrote", len(frames), "states")
    out = os.path.join("assets", "images", "landmarks")
    os.makedirs(out, exist_ok=True)
    for code in SKETCH:
        export_png(code, os.path.join(out, f"{code.lower()}.png"))
        print("wrote", code)
    write_ts(sorted(SKETCH), frames)

