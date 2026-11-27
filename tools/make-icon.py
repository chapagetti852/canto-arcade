"""The site's icon (home screen, browser tab): a neon pixel arcade cabinet whose red screen shows a white
bauhinia, drawn on a 32 px grid and scaled up with sharp pixels. Writes public/favicon.png (32),
public/apple-touch-icon.png (180), public/icon-192.png, public/icon-512.png. Run: python3 tools/make-icon.py"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')
C = dict(k=(18, 11, 36), K=(11, 7, 22), P=(255, 79, 163), p=(184, 50, 122), q=(122, 30, 84), C=(45, 226, 230), c=(26, 138, 149),
         R=(216, 35, 31), r=(150, 20, 20), W=(255, 255, 255), Y=(255, 209, 102), G=(70, 60, 96), g=(42, 34, 66))
rows = [
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "kkkkkkkkKKKKKKKKKKKKKKKKkkkkkkkk",
    "kkkkkkkKCCCCCCCCCCCCCCCCKkkkkkkk",
    "kkkkkkkKCYcYcYcYcYcYcYcCKkkkkkkk",
    "kkkkkkkKCCCCCCCCCCCCCCCCKkkkkkkk",
    "kkkkkkkKccccccccccccccccKkkkkkkk",
    "kkkkkkkKPPPPPPPPPPPPPPPpKkkkkkkk",
    "kkkkkkkKPKKKKKKKKKKKKKPpKkkkkkkk",
    "kkkkkkkKPKRRRRRRRRRRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRRRWRRRRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRRRWWRRRRKPpKkkkkkkk",
    "kkkkkkkKPKRRWWRWRRWRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRWWWWWRRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRRWRWWRRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRWRRRWWRRKPpKkkkkkkk",
    "kkkkkkkKPKRRRRRRRRRRRKPpKkkkkkkk",
    "kkkkkkkKPKrrrrrrrrrrrKPpKkkkkkkk",
    "kkkkkkkKPKKKKKKKKKKKKKPpKkkkkkkk",
    "kkkkkkKPPPPPPPPPPPPPPPPpKkkkkkkk",
    "kkkkkKPPPRRPPPPPPPPPPPPPpKkkkkkk",
    "kkkkKPPPPRRPPPPYYPPCCPPPPpKkkkkk",
    "kkkkKqqqqqGqqqqYYqqCCqqqqqKkkkkk",
    "kkkkkKKKKKKKKKKKKKKKKKKKKKkkkkkk",
    "kkkkkkkKPPPPPPPPPPPPPPPpKkkkkkkk",
    "kkkkkkkKPPPPPPKKKKPPPPPpKkkkkkkk",
    "kkkkkkkKPPPPPPKYYKPPPPPpKkkkkkkk",
    "kkkkkkkKPPPPPPKKKKPPPPPpKkkkkkkk",
    "kkkkkkkKPPPPPPPPPPPPPPPpKkkkkkkk",
    "kkkkkkkKqqqqqqqqqqqqqqqqKkkkkkkk",
    "kkkkkkKKKKKKKKKKKKKKKKKKKKkkkkkk",
    "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
]
assert len(rows) == 32 and all(len(r) == 32 for r in rows), [len(r) for r in rows]
im = Image.new('RGB', (32, 32))
for y, row in enumerate(rows):
    for x, ch in enumerate(row): im.putpixel((x, y), C[ch])
im.save(f'{OUT}/favicon.png')
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    im.resize((size, size), Image.NEAREST).save(f'{OUT}/{name}')
# 180 px for iOS: 36 px grid (a 2 px margin of background) × 5
big = Image.new('RGB', (36, 36), C['k']); big.paste(im, (2, 2)); big.resize((180, 180), Image.NEAREST).save(f'{OUT}/apple-touch-icon.png')
print('icons written to', OUT)
