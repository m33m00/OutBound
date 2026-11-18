"""
Paper grain for Jaunt's results tickets (round 221, John picked the paper grain look). Writes two small 3x tiles that
repeat across a ticket: assets/images/grain-light@3x.png (dark flecks, for light mode) and grain-dark@3x.png (pale flecks,
for dark mode). Fine noise plus a few short fibers, a few percent at most, so the paper reads as paper and the text
stays crisp. Run from the repo root: python3 design/paper-grain.py
"""
import math
import numpy as np
from PIL import Image, ImageDraw

N = 256  # pixels; about 85 pt at 3x


def tile(seed, strength, fibers):
    rng = np.random.default_rng(seed)
    a = np.abs(rng.normal(0, 1, (N, N))) * strength
    fib = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(fib)
    for _ in range(int(N * N / 900)):
        x, y = rng.uniform(0, N), rng.uniform(0, N)
        ln, ang = rng.uniform(4, 12), rng.uniform(-0.5, 0.5)
        for ox in (-N, 0, N):  # draw wrapped so the tile repeats without seams
            for oy in (-N, 0, N):
                d.line([(x + ox, y + oy), (x + ox + ln * math.cos(ang), y + oy + ln * math.sin(ang))],
                       fill=int(rng.uniform(80, 255)), width=1)
    a = a + np.asarray(fib, dtype=np.float32) / 255.0 * fibers
    return np.clip(a, 0, 255).astype(np.uint8)


def write(path, rgb, alpha):
    """Writes the 3x tile, and a 1x copy under the plain name that the app requires (Metro then picks the 3x)."""
    img = Image.new("RGBA", (N, N), rgb + (0,))
    img.putalpha(Image.fromarray(alpha))
    img.save(path, optimize=True)
    img.resize((N // 3, N // 3), Image.LANCZOS).save(path.replace("@3x", ""), optimize=True)


if __name__ == "__main__":
    write("assets/images/grain-light@3x.png", (60, 50, 40), tile(7, 4.2, 6.0))
    write("assets/images/grain-dark@3x.png", (255, 255, 255), tile(8, 3.0, 4.5))
    print("ok")
