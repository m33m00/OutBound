"""
OutBound app icon (Q-055, John 2026-10-30: "You design it").
Ink blue background, white route arc from an amber origin dot (amber = you),
white plane leaving up and to the right. Draws all icon sizes with Pillow:
  python3 design/assets/make-icon.py   (writes PNGs into the current folder;
  copy them to assets/images/ as icon.png, android-icon-*.png, favicon.png)
"""
import math
from PIL import Image, ImageDraw
# Composition on a 1024 canvas, centered as a whole.
S = (300, 735); C1 = (300, 480); C2 = (470, 330); E = (668, 312)
PLANE = 0.95   # plane scale
right = [(0,-118),(15,-104),(17,-34),(112,22),(112,44),(17,22),(14,72),(46,96),(46,112),(0,100)]
pts = right + [(-x,y) for x,y in reversed(right[1:-1])]
ang = math.atan2(E[1]-C2[1], E[0]-C2[0]) + math.pi/2   # plane drawn pointing up
# plane center sits ahead of the arc end so the tail meets the line
ahead = 70*PLANE
PC = (E[0] + ahead*math.cos(ang-math.pi/2), E[1] + ahead*math.sin(ang-math.pi/2))
K = 4
def bez(t):
    u=1-t
    return (u**3*S[0]+3*u*u*t*C1[0]+3*u*t*t*C2[0]+t**3*E[0], u**3*S[1]+3*u*u*t*C1[1]+3*u*t*t*C2[1]+t**3*E[1])
def bbox():
    xs=[bez(i/200)[0] for i in range(201)]; ys=[bez(i/200)[1] for i in range(201)]
    for x,y in pts:
        x,y=x*PLANE,y*PLANE
        xs.append(PC[0]+x*math.cos(ang)-y*math.sin(ang)); ys.append(PC[1]+x*math.sin(ang)+y*math.cos(ang))
    xs += [S[0]-62,S[0]+62]; ys += [S[1]-62,S[1]+62]
    return min(xs),min(ys),max(xs),max(ys)
x0,y0,x1,y1 = bbox()
CENTER = (512-(x0+x1)/2, 512-(y0+y1)/2)
def render(size, bg, arc, dot, ring, scale=1.0):
    W = 1024*K
    im = Image.new('RGBA',(W,W), bg if bg else (0,0,0,0))
    d = ImageDraw.Draw(im)
    off = 512*(1-scale)
    tf = lambda p: (((p[0]+CENTER[0])*scale+off)*K, ((p[1]+CENTER[1])*scale+off)*K)
    r = 26*scale*K
    for i in range(1201):
        p = tf(bez(i/1200)); d.ellipse([p[0]-r,p[1]-r,p[0]+r,p[1]+r], fill=arc)
    c = tf(S)
    for rad, col in ((62, ring), (38, dot)):
        R = rad*scale*K; d.ellipse([c[0]-R,c[1]-R,c[0]+R,c[1]+R], fill=col)
    poly=[]
    for x,y in pts:
        x,y = x*PLANE, y*PLANE
        poly.append(tf((PC[0]+x*math.cos(ang)-y*math.sin(ang), PC[1]+x*math.sin(ang)+y*math.cos(ang))))
    d.polygon(poly, fill=arc)
    return im.resize((size,size), Image.LANCZOS)
INK=(29,61,132,255); WHITE=(255,255,255,255); AMBER=(255,178,90,255); CLEAR=(0,0,0,0)
render(1024, INK, WHITE, AMBER, WHITE).convert('RGB').save('icon.png')
render(1024, None, WHITE, AMBER, WHITE).save('layer.png')
render(512, None, WHITE, AMBER, WHITE, scale=0.62).save('android-fg.png')
Image.new('RGBA',(512,512),INK).save('android-bg.png')
render(432, None, WHITE, CLEAR, WHITE, scale=0.62).save('android-mono.png')
render(48, INK, WHITE, AMBER, WHITE).save('favicon.png')
print('bbox', round(x0),round(y0),round(x1),round(y1))
