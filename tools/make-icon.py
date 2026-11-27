"""Canto Town's icon: the game's own map of Hong Kong, as a clean pixel picture (sea, hills, towns,
the mainland across the border) with a red pin at Tsing Yi, where you start.
Drawn from games/hk-map/public/img/world.png: a 64 px grid for the big icons, a 32 px grid (and 16 px) for
the browser tab, in every format the site needs:
  public/favicon.ico (16+32+48), favicon.png (32), favicon.svg (crisp at any size),
  apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-512.png (safe margin for Android).
Run: python3 tools/make-icon.py"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public')
cls = np.array(Image.open(os.path.join(ROOT, 'games/hk-map/public/img/world.png')))
H, W = cls.shape

SEA, SEA2, LAND, HILL, TOWN, CHINA, EDGE, PIN, PIN2 = (44, 92, 140), (56, 108, 158), (132, 186, 104), (82, 140, 72), (240, 228, 200), (184, 174, 150), (22, 50, 82), (232, 52, 46), (255, 255, 255)
# terrain class → icon colour (see build/world.py): water, hills, towns, the mainland, the rest is green land
KIND = np.zeros(256, np.uint8)  # 0 sea, 1 land, 2 hill, 3 town, 4 china
for c in (5, 6, 7): KIND[c] = 2
for c in (9, 10, 12, 13, 14, 15, 19, 20, 21): KIND[c] = 3
for c in (3, 4, 8, 11): KIND[c] = 1
KIND[18] = 4
kind = KIND[cls]

# a square around Hong Kong (the mainland's edge across the top)
x0, x1, y0, y1 = 90, 2230, 0, 1664
side = x1 - x0
cy = (y0 + y1) // 2 + 40
top = cy - side // 2

def grid(n):
    """n×n icon pixels: the most common kind in each block (towns win a little more often, so cities show)."""
    out = np.zeros((n, n), np.uint8)
    for j in range(n):
        for i in range(n):
            ya, yb = top + j * side // n, top + (j + 1) * side // n
            xa, xb = x0 + i * side // n, x0 + (i + 1) * side // n
            blk = kind[max(0, ya):max(0, min(H, yb)), max(0, xa):min(W, xb)]
            if blk.size == 0: continue
            counts = np.bincount(blk.ravel(), minlength=5).astype(float)
            counts[3] *= 1.6
            out[j, i] = int(np.argmax(counts))
    return out

PAL = {0: SEA, 1: LAND, 2: HILL, 3: TOWN, 4: CHINA}
def picture(n, pin=True):
    g = grid(n)
    im = Image.new('RGB', (n, n))
    px = im.load()
    for j in range(n):
        for i in range(n):
            k = g[j, i]
            if k == 0:
                near = any(0 <= j + dj < n and 0 <= i + di < n and g[j + dj, i + di] != 0 for dj in (-1, 0, 1) for di in (-1, 0, 1))
                px[i, j] = SEA2 if near else SEA
            else:
                px[i, j] = PAL[k]
    # a dark coastline where land meets sea (only on the bigger grid: at 32 px it would eat the islands)
    if n >= 64:
        for j in range(n):
            for i in range(n):
                if g[j, i] == 0 and any(0 <= j + dj < n and 0 <= i + di < n and g[j + dj, i + di] in (1, 2, 3) for dj, di in ((0, 1), (1, 0), (0, -1), (-1, 0))):
                    px[i, j] = EDGE
    if pin:  # a map pin on Tsing Yi, where you start (cell 1052, 819): round red head, white dot, point below
        pi, pj = int((1052 - x0) / side * n), int((819 - top) / side * n)
        shape = (['.kkkkk.', 'krrrrrk', 'krrwrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'] if n >= 64
                 else ['.kkk.', 'krwrk', 'krrrk', '.krk.', '..k..'])
        h, w = len(shape), len(shape[0])
        for dj, row in enumerate(shape):
            for di, ch in enumerate(row):
                x, y = pi - w // 2 + di, pj - (h - 1) + dj  # the point sits on Tsing Yi
                if ch != '.' and 0 <= x < n and 0 <= y < n: px[x, y] = {'k': (60, 10, 14), 'r': PIN, 'w': PIN2}[ch]
    return im

big, small, tiny = picture(64), picture(32), picture(16, pin=False)
small.save(f'{OUT}/favicon.png')
small.resize((48, 48), Image.NEAREST).save(f'{OUT}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[tiny, small])
for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    # whole multiples of the 64 px grid where possible, nearest-neighbour so the pixels stay square
    big.resize((size, size), Image.NEAREST).save(f'{OUT}/{name}')
# Android's masked icon: the picture inside the 80% safe zone, sea all round
m = Image.new('RGB', (80, 80), SEA); m.paste(big, (8, 8)); m.resize((512, 512), Image.NEAREST).save(f'{OUT}/icon-maskable-512.png')
# SVG: one rect per run of same-coloured pixels on the 32 px grid, crisp at any size
rects = []
p = small.load()
for j in range(32):
    i = 0
    while i < 32:
        c = p[i, j]; k = i
        while k + 1 < 32 and p[k + 1, j] == c: k += 1
        rects.append(f'<rect x="{i}" y="{j}" width="{k - i + 1}" height="1" fill="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"/>')
        i = k + 1
open(f'{OUT}/favicon.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">' + ''.join(rects) + '</svg>\n')
big.resize((256, 256), Image.NEAREST).save('/tmp/claude-0/-home-user-canto-arcade/7e9adda2-c0ce-522a-960b-1a7c516ead48/scratchpad/icon64.png')
small.resize((256, 256), Image.NEAREST).save('/tmp/claude-0/-home-user-canto-arcade/7e9adda2-c0ce-522a-960b-1a7c516ead48/scratchpad/icon32.png')
print('icons written to', OUT)
