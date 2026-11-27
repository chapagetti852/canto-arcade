"""The open world's ground: one terrain class per 30 m cell, read back from the map picture.

public/img/map.png is drawn at 2 pixels per world unit (60 m), so each of its pixels is one 30 m
world tile. Its 64 colours each come from one step of render_map.py; this maps every colour back
to what it was drawn for (sea, road, urban block, park, …). Vegetation takes its band (lowland,
wood, scrub, hilltop) from the terrain heights instead of its shaded colour. Small specks are
merged into their surroundings so areas read as clean shapes.

Writes public/img/world.png: an 8-bit greyscale picture whose value is the class (see CLASSES,
mirrored in src/overworld/terrain.ts). Run: python3 build/world.py
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLASSES = ['deep', 'sea', 'shore', 'sand', 'grass', 'wood', 'scrub', 'top', 'farm', 'urban', 'industrial',
           'park', 'airport', 'runway', 'motorway', 'road', 'reservoir', 'pond', 'china', 'bridge', 'pier', 'containers']
C = {n: i for i, n in enumerate(CLASSES)}

im = Image.open(HK + '/public/img/map.png')
idx = np.array(im)
pal = np.array(im.getpalette()[:256 * 3]).reshape(-1, 3)
H, W = idx.shape

# every palette colour → what render_map.py drew it for (by its RGB; quantised colours land on the nearest)
DRAWN = {
    'deep': [(52, 98, 143), (62, 111, 158), (77, 124, 170), (44, 85, 128), (46, 88, 132), (38, 74, 116)],
    'sea': [(88, 140, 186), (92, 146, 190), (176, 210, 230), (226, 240, 244), (52, 104, 168)],
    'reservoir': [(126, 178, 214)],
    'pond': [(104, 150, 140), (128, 172, 160), (164, 186, 128)],
    'china': [(214, 208, 189), (203, 196, 176), (180, 172, 150)],
    'urban': [(222, 212, 196), (200, 188, 174), (184, 172, 160), (176, 164, 156), (188, 176, 166)],
    'industrial': [(206, 198, 204), (186, 178, 188)],
    'park': [(190, 212, 146), (146, 182, 100)],
    'airport': [(204, 204, 198), (192, 192, 186)],
    'runway': [(96, 96, 102), (96, 98, 104)],
    'road': [(250, 246, 236), (250, 245, 230)],
    'motorway': [(232, 156, 98)],
    'casing': [(158, 148, 136), (168, 104, 74)],     # a road's outline: the ground under it, not road
    'bridge': [(220, 216, 206), (126, 120, 112), (125, 120, 109), (84, 84, 94), (180, 180, 190), (52, 52, 60)],
    'pier': [(206, 196, 178)],
    'sand': [(250, 230, 146), (232, 206, 120), (226, 72, 60), (70, 140, 210), (222, 210, 164)],
    'containers': [(196, 66, 54), (222, 140, 52), (58, 140, 92), (150, 150, 156), (168, 52, 110), (184, 60, 78)],
    'farm': [(178, 196, 120), (196, 196, 132), (138, 170, 96)],
    '?': [(150, 118, 78), (196, 176, 132), (150, 112, 70), (110, 80, 50), (176, 120, 60)],   # borders, coast edge, rafts: take the neighbours'
}
ref = [(np.array(c), n) for n, cs in DRAWN.items() for c in cs]
cls_of = np.zeros(256, np.int16)
veg = np.zeros(256, bool)
for i, rgb in enumerate(pal):
    r, g, b = (int(v) for v in rgb)
    d, name = min((float(np.sum((c - rgb) ** 2)), n) for c, n in ref)
    if d > 60 and g > r and g > b - 10:        # a shaded green not in the list: vegetation (banded by height below)
        veg[i] = True; cls_of[i] = -2; continue
    cls_of[i] = -1 if name == '?' else -3 if name == 'casing' else C[name]
cls = cls_of[idx]
# road outlines: whatever non-road ground is nearest (a road is then as wide as its own surface)
cas = cls == -3
if cas.any():
    other = np.where(cas | np.isin(cls, [C['road'], C['motorway']]), -1, cls)
    _, (iy, ix) = nd.distance_transform_edt(other < 0, return_indices=True)
    cls[cas] = other[iy[cas], ix[cas]]

# farmland only exists on the north-west plains (render_map.py's farm zone); elsewhere those colours are shaded hillside
yy, xx = np.mgrid[0:H, 0:W]
farmzone = (xx >= 600) & (xx <= 1400) & (yy >= 240) & (yy <= 660)
cls[(cls == C['farm']) & ~farmzone] = -2

# vegetation by height (the same bands render_map.py used: 40, 260, 520 m)
dem = np.load(HK + '/data/osm/dem4.npy').astype(float)
E = nd.gaussian_filter(nd.zoom(dem, (H / dem.shape[0], W / dem.shape[1]), order=1)[:H, :W], 3)
band = np.digitize(E, [40, 260, 520])
v = cls == -2
for b, name in enumerate(['grass', 'wood', 'scrub', 'top']): cls[v & (band == b)] = C[name]

# '?' cells (district borders, the coastline edge): the most common class around them
unk = cls < 0
if unk.any():
    _, (iy, ix) = nd.distance_transform_edt(unk, return_indices=True)
    cls[unk] = cls[iy[unk], ix[unk]]

# natural ground: the old map dithered parks, fields and hill shading in 2-pixel patterns, which come out as
# checkerboards of classes; each natural cell takes the most common natural class in the 5×5 around it
NAT = [C[n] for n in ('grass', 'wood', 'scrub', 'top', 'farm', 'park')]
nat = np.isin(cls, NAT)
votes = np.stack([nd.uniform_filter((cls == c).astype(np.float32), 5) for c in NAT])
cls[nat] = np.array(NAT, np.int16)[np.argmax(votes, axis=0)][nat]

# tidy: specks of up to 2 cells become their surroundings (roads, bridges and piers stay, however thin)
KEEP = {C[n] for n in ('motorway', 'road', 'bridge', 'pier', 'runway')}
for _ in range(2):
    out = cls.copy()
    for c in np.unique(cls):
        if c in KEEP: continue
        lab, n = nd.label(cls == c)
        if n == 0: continue
        sz = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
        small = np.isin(lab, 1 + np.nonzero(sz <= 2)[0])
        if small.any():
            other = np.where(small, -1, cls)
            _, (iy, ix) = nd.distance_transform_edt(other < 0, return_indices=True)
            out[small] = other[iy[small], ix[small]]
    cls = out

# shallow sea: the water within 5 cells (150 m) of land
land = ~np.isin(cls, [C['deep'], C['sea']])
cls[(cls == C['deep']) & nd.binary_dilation(land, iterations=5)] = C['sea']

Image.fromarray(cls.astype(np.uint8), 'L').save(HK + '/public/img/world.png', optimize=True)
u, n = np.unique(cls, return_counts=True)
print('world.png', W, 'x', H, '·', ', '.join(f'{CLASSES[a]} {b}' for a, b in zip(u, n)))
