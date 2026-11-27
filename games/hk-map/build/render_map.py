
import os as _os
HK = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))          # games/hk-map
OUT = _os.path.join(HK, "public")                                            # the game's static files (Vite copies them into the build)
EXT = _os.environ.get("HKMAP_EXTERNAL", "/home/claude/hkmap-external")       # big map-rendering inputs not kept in the repo (see README)
"""Render the game's base map: a pixel 'paper atlas' of Hong Kong.
Inputs: land/China masks (OSM land polygons + Natural Earth), reservoir outlines and peaks from OpenStreetMap."""
import numpy as np, math, random
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

import json
K = 2                                   # the map is drawn at twice the game's coordinate grid
W0, H0 = 1129, 832; W, H = W0 * K, H0 * K
C = math.cos(math.radians(22.35))
def P(lon, lat): return ((lon - 113.80) * 1850 * C * K, (22.58 - lat) * 1850 * K)
def raster(path, src):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for f in json.load(open(path))['features']:
        g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for i, ring in enumerate(poly):
                pts = [P(*c[:2]) for c in ring]
                if len(pts) > 2: d.polygon(pts, fill=0 if i else 255)
    return np.array(m) > 0
G = EXT+"/hk-terrestrial-geojson"+'/'
hk = raster(G + 'hk_terrestrial_2m.geojson', 1)          # Lands Department iB5000 land (CSDI)
terr = raster(G + 'hk_boundary.geojson', 1)               # the HKSAR boundary, land and sea
up = lambda p: np.array(Image.open(p).convert('L').resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.5))) > 120
cn = up(EXT+"/geo"+'/land_mask.png') & up(EXT+"/geo"+'/cn_mask.png') & ~terr
hk0 = hk; disk = np.add.outer(np.arange(-2, 3) ** 2, np.arange(-2, 3) ** 2) <= 5
ho = nd.binary_opening(hk0, structure=disk)
hk = hk0 & nd.binary_dilation(ho, iterations=1)
lab0, n0 = nd.label(hk0); keep = np.setdiff1d(np.arange(1, n0 + 1), np.unique(lab0[ho]))
hk |= np.isin(lab0, keep)                                          # islets too small to survive the opening stay as they are
land = hk | cn
sea = ~land

PAL = dict(
    deep=(52, 98, 143), mid=(62, 111, 158), shallow=(88, 140, 186), foam=(176, 210, 230), wave=(77, 124, 170),
    land=(239, 226, 191), grain=(229, 214, 176), edge=(196, 176, 132),
    cn=(214, 208, 189), cnhatch=(203, 196, 176), cnedge=(180, 172, 150),
    hill=(196, 210, 146), hill2=(172, 196, 120), tree=(146, 176, 96), treeD=(118, 150, 76),
    res=(126, 178, 214), resE=(92, 146, 190),
    mt=(108, 138, 76), mtF=(160, 186, 112), snow=(250, 248, 236),
)
img = np.zeros((H, W, 3), np.uint8)

# --- sea, with depth bands, foam and little waves ---
dist = nd.distance_transform_edt(sea)
img[sea] = PAL['deep']
img[sea & (dist <= 9*K)] = PAL['mid']
img[sea & (dist <= 3*K)] = PAL['shallow']
img[sea & (dist <= 1.5)] = PAL['foam']
rng = random.Random(7)
def blk(y, x, c):
    img[y*K:(y+1)*K, x*K:(x+1)*K] = c
for y in range(6, H0 - 4, 16):
    off = (y // 16) % 2 * 13
    for x in range(off + 4, W0 - 12, 26):
        xx, yy = x + rng.randint(-3, 3), y + rng.randint(-2, 2)
        if dist[yy*K, xx*K] > 9*K and dist[yy*K, (xx + 4)*K] > 9*K:
            for (a, b) in ((yy, xx), (yy - 1, xx + 1), (yy - 1, xx + 2), (yy, xx + 3)): blk(a, b, PAL['wave'])

# --- land: real terrain (AWS Terrain Tiles, 16 m steps), shaded like a pixel-art relief map ---
yy, xx = np.mgrid[0:H, 0:W]
gx, gy = xx // K, yy // K
dem = np.load(HK+"/data/osm"+'/dem4.npy').astype(float)                   # 283 x 208, 4 world px per cell
E = nd.zoom(dem, (H / dem.shape[0], W / dem.shape[1]), order=1)[:H, :W]
E = nd.gaussian_filter(E, 1.6 * K)
E[~land] = 0
# light from the north-west; slope measured per world pixel (~60 m)
dy, dx = np.gradient(E / 30.0)
shade = (-dx * 0.70710678 - dy * 0.70710678) / np.sqrt(1 + dx * dx + dy * dy)
slope = np.sqrt(dx * dx + dy * dy)
# vegetation by height: shrubby lowland, wooded slopes, scrub, grassy tops
V = dict(low=(150, 186, 108), wood=(106, 152, 84), scrub=(128, 164, 92), top=(170, 178, 114), farm1=(178, 196, 120), farm2=(196, 196, 132), shore=(222, 210, 164))
base = np.zeros((H, W, 3), np.int16)
band = np.digitize(E, [40, 260, 520])
for b, c in enumerate([V['low'], V['wood'], V['scrub'], V['top']]): base[band == b] = c
# farmland and villages on the flat north-west plains
farmz = (E < 22) & (slope < 0.25) & (xx >= 300 * K) & (xx <= 700 * K) & (yy <= 330 * K) & (yy >= 120 * K)
fx_, fy_ = gx // 7, gy // 5
cell = (fx_ * 7919 + fy_ * 104729) % 7
base[farmz & (cell < 3)] = V['farm1']; base[farmz & (cell == 3)] = V['farm2']
base[farmz & ((gx % 7 == 0) | (gy % 5 == 0))] = (138, 170, 96)
# pixel shading: three steps, with a checker dither between them
sh = np.clip(shade * 2.4, -1.5, 1.5); chk = ((gx + gy) % 2 == 0)
lvl = np.where(sh > 0.55, 1, np.where(sh < -0.55, -1, 0)) + np.where((np.abs(sh) > 0.35) & (np.abs(sh) <= 0.55) & chk, np.sign(sh), 0)
lvl = np.clip(lvl + np.where(sh < -1.1, -1, 0), -2, 1)
mul = np.choose((lvl + 2).astype(int), [0.70, 0.84, 1.0, 1.10])
land_rgb = np.clip(base * mul[..., None], 0, 255).astype(np.uint8)
# tree canopy texture on the wooded and scrub bands, darker on the shady side
canopy = (band >= 1) & (band <= 2) & ((((gx % 3) == 0) & ((gy % 3) == 1)) | (((gx % 3) == 2) & ((gy % 3) == 0) & (band == 1)))
land_rgb[canopy] = np.clip(land_rgb[canopy].astype(int) - 22, 0, 255)
img[hk] = land_rgb[hk]
# a thin rocky/sandy shore line
shore = hk & nd.binary_dilation(sea, iterations=K) & ~nd.binary_dilation(sea, iterations=0)
img[shore] = V['shore']
img[cn] = PAL['cn']
img[cn & ((gx + gy) % 6 == 0)] = PAL['cnhatch']
hill = np.zeros((H, W), bool)

# --- land use from OpenStreetMap (urban / industrial / parks / airport), as a 565x416 class raster ---
from skimage.morphology import skeletonize
OSM = HK+"/data/osm"+'/'
cls = np.load(OSM + 'areas_half.npy')                          # 0 none, 1 urban, 2 industrial, 3 green, 4 airport
c1 = np.kron(cls, np.ones((2, 2), np.uint8))[:H0, :W0]         # world grid
def tidy(m, o=1, c=1):
    m = nd.binary_closing(m, iterations=c); return nd.binary_opening(m, iterations=o) if o else m
hk1 = hk.reshape(H0, K, W0, K).any(axis=(1, 3))
U1 = tidy((c1 == 1) | nd.binary_dilation(c1 == 1, iterations=2) & (nd.uniform_filter((c1 == 1).astype(float), 9) > .33), 1, 2) & hk1
rdd = np.kron(np.load(OSM + 'roads_half.npy') > 0, np.ones((2, 2), bool))[:H0, :W0]
U1 |= (nd.uniform_filter(rdd.astype(float), 11) > .16) & nd.binary_dilation(U1, iterations=6) & hk1 & (c1 != 3)
lbl, n = nd.label(U1); sz = nd.sum(U1, lbl, range(1, n + 1)); U1 &= np.isin(lbl, 1 + np.nonzero(sz >= 24)[0]); I1 = tidy(c1 == 2) & hk1 & ~U1; A1 = tidy(c1 == 4, 1, 2) & hk1
G1 = tidy(c1 == 3) & hk1 & ~U1 & ~I1 & ~A1
U1 &= ~A1; I1 &= ~A1
gx1, gy1 = np.mgrid[0:H0, 0:W0][::-1]
r1 = np.random.default_rng(11).random((H0, W0))
lu = np.zeros((H0, W0, 3), np.uint8); lum = np.zeros((H0, W0), bool)
def put(m, c): lu[m] = c; lum[m] = True
# urban: pale streets, warm-grey blocks, the odd taller (darker) building with a lit top
put(U1, (222, 212, 196))
blocks = U1 & (gx1 % 4 != 0) & (gy1 % 3 != 0)
put(blocks, (200, 188, 174))
tall = blocks & (r1 < .16)
put(tall, (176, 164, 156)); put(tall & (gy1 % 3 == 1), (188, 176, 166))
# industrial: lilac-grey sheds in stripes
put(I1, (206, 198, 204)); put(I1 & ((gx1 + gy1) % 4 == 0), (186, 178, 188))
# parks: lawn green with tree dots
put(G1, (190, 212, 146)); put(G1 & (gx1 % 3 == 1) & (gy1 % 3 == 1), (146, 182, 100))
# airport: apron grey
put(A1, (204, 204, 198)); put(A1 & ((gx1 * 3 + gy1) % 11 == 0), (192, 192, 186))
# edges of built-up areas a touch darker so districts read as shapes
bu = U1 | I1
put(bu & ~nd.binary_erosion(bu), (184, 172, 160))
up2 = lambda a: a.repeat(K, 0).repeat(K, 1)
LU, LUM = up2(lu), up2(lum) & hk
img[LUM] = LU[LUM]

# roads: motorway/trunk in orange with a dark casing, primary roads pale; thinned to one world pixel
rd2 = np.kron(np.load(OSM + 'roads_half.npy'), np.ones((2, 2), np.uint8))[:H0, :W0]
near1 = hk1 | nd.binary_dilation(hk1, iterations=3)                 # coastal viaducts: up to 3 world px off the shore
mw = skeletonize(nd.binary_closing(rd2 == 2)) & near1
pr = skeletonize(nd.binary_closing(rd2 >= 1)) & hk1 & ~nd.binary_dilation(mw)
nearM = hk | (up2(near1) & ~cn)
prM, mwM = up2(pr) & hk, up2(mw) & nearM
img[nd.shift(nd.binary_dilation(mwM, iterations=1), (2, 1), order=0) & sea & ~nd.binary_dilation(mwM, iterations=1)] = (46, 88, 132)   # viaduct shadow
pcase = nd.binary_dilation(prM, iterations=1) & ~prM & hk
img[pcase] = (158, 148, 136); img[prM] = (250, 246, 236)
case = nd.binary_dilation(mwM, iterations=1) & ~mwM & nearM
img[case] = (168, 104, 74); img[mwM] = (232, 156, 98)
# runways (OSM aeroway=runway): dark strips with a white dashed centre line
RW = [(113.88070, 22.32107, 113.91715, 22.33282), (113.89360, 22.30951, 113.93235, 22.32199),
      (113.89797, 22.29623, 113.93282, 22.30747), (114.07179, 22.43968, 114.08888, 22.43344)]
rwi = Image.fromarray(img); rdw = ImageDraw.Draw(rwi)
for a, b, c, d in RW:
    p, q = P(a, b), P(c, d); rdw.line([p, q], fill=(96, 98, 104), width=3 * K)
    n = int(math.dist(p, q) // (4 * K))
    for i in range(1, n, 2):
        t0, t1 = i / n, (i + .6) / n
        rdw.line([(p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0), (p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1)], fill=(244, 244, 236), width=1)
img[:] = np.array(rwi)

# --- little touches: beaches, Deep Bay fish ponds, the Kwai Tsing container stacks, fish rafts ---
rT = np.random.default_rng(852)
W1 = lambda lo, la: (int((lo - 113.80) * 1850 * C), int((22.58 - la) * 1850))
land1 = hk1 & ~(np.array(Image.fromarray(sea).resize((W0, H0), Image.NEAREST)) > 0) if False else hk1
sea1 = sea.reshape(H0, K, W0, K).all(axis=(1, 3))
coast1 = land1 & nd.binary_dilation(sea1, iterations=2)
put1 = lambda m, c: (lu.__setitem__(m, c), lum.__setitem__(m, True))
BEACH = [(114.1967, 22.2365), (114.1858, 22.2470), (114.2190, 22.2215), (114.2525, 22.2290), (114.2465, 22.2445), (113.9550, 22.2290), (113.9800, 22.2380),
         (114.2730, 22.3245), (114.2990, 22.2870), (114.3780, 22.4100), (113.9810, 22.3700), (114.0315, 22.2105), (114.1140, 22.2220), (114.1145, 22.2050), (114.3600, 22.3600), (113.9300, 22.2250)]
beach = np.zeros((H0, W0), bool)
for lo, la in BEACH:
    x, y = W1(lo, la); by_, bx_ = np.ogrid[:H0, :W0]; beach |= ((bx_ - x) ** 2 + (by_ - y) ** 2 <= 49) & coast1 & ~U1
put1(beach, (250, 230, 146)); put1(beach & (r1 < .1), (232, 206, 120))
umb = beach & (r1 > .94); put1(umb, (226, 72, 60)); put1(umb & (r1 > .97), (70, 140, 210))          # beach umbrellas
foam = sea1 & nd.binary_dilation(beach, iterations=1) & ~nd.binary_dilation(land1, iterations=0)
# fish ponds (魚塘) around Mai Po and Nam Sang Wai: a grid of teal ponds with grassy dikes
x0, y0 = W1(113.995, 22.505); x1, y1 = W1(114.075, 22.445)
pz = np.zeros((H0, W0), bool); pz[y0:y1, x0:x1] = True; pz &= nd.gaussian_filter(rT.random((H0, W0)), 6) > 0.5; pz = nd.binary_opening(nd.binary_closing(pz, iterations=2), iterations=2); pz &= land1 & ~U1 & ~I1 & ~nd.binary_dilation(sea1, iterations=1)
pond = pz & (gx1 % 6 != 0) & (gy1 % 5 != 0)
put1(pz, (164, 186, 128)); put1(pond, (104, 150, 140)); put1(pond & ((gx1 + gy1 * 3) % 17 == 0), (128, 172, 160))
# Kwai Tsing container terminals: colourful stacks on the port's industrial land
x0, y0 = W1(114.100, 22.366); x1, y1 = W1(114.140, 22.330)
cz = np.zeros((H0, W0), bool); cz[y0:y1, x0:x1] = True; cz &= I1
CC = [(196, 66, 54), (52, 104, 168), (58, 140, 92), (222, 140, 52), (150, 150, 156), (168, 52, 110)]
for k, c in enumerate(CC): put1(cz & (gy1 % 3 != 0) & (((gx1 // 3) * 7 + (gy1 // 3) * 3) % len(CC) == k), c)
up2b = lambda a: a.repeat(K, 0).repeat(K, 1)
LU2, LUM2 = up2b(lu), up2b(beach | pz | cz) & hk & ~(prM | mwM | case | pcase)
img[LUM2] = LU2[LUM2]
img[up2b(foam) & sea] = (226, 240, 244)
# fish rafts (魚排) in quiet bays: little wooden platforms with huts
for lo, la, n in [(114.2850, 22.3770, 6), (114.1330, 22.2060, 5), (114.3060, 22.2700, 4), (113.8600, 22.2560, 4)]:
    x, y = W1(lo, la)
    for k in range(n):
        px, py = (x + (k % 3) * 4) * K, (y + (k // 3) * 4) * K
        if sea[py:py + 3 * K, px:px + 3 * K].all():
            img[py:py + 3 * K, px:px + 3 * K] = (150, 112, 70); img[py:py + 3 * K, px:px + 1] = (110, 80, 50); img[py + K:py + 2 * K, px + K:px + 2 * K] = (220, 210, 190)

# --- bridges over the sea (OSM bridge=yes), with towers on the big ones ---
BR = json.load(open(HK+"/build"+'/bridges.json'))
def along(pts, t):
    L = [math.dist(a, b) for a, b in zip(pts, pts[1:])]; d = t * sum(L)
    for (a, b), l in zip(zip(pts, pts[1:]), L):
        if d <= l: return (a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l)
        d -= l
    return pts[-1]
dm = Image.new('L', (W, H), 0); dd = ImageDraw.Draw(dm); sm = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(sm)
for k, b in BR.items():
    pts = [(x * K, y * K) for x, y in b['pts']]; wd = 3 * K if k in ('tsingma', 'hzmb', 'stonecutters', 'szbay') else 2 * K
    dd.line(pts, fill=255, width=wd, joint='curve'); sd.line([(x + 1 * K, y + 1.5 * K) for x, y in pts], fill=255, width=wd, joint='curve')
dd.ellipse([73 * K, 550.6 * K, 88 * K, 555.2 * K], fill=255)  # the bridge's artificial island, where the road dives into the undersea tunnel
deck = (np.array(dm) > 0) & sea; shad = (np.array(sm) > 0) & sea & ~deck
img[shad] = (46, 88, 132)
img[deck] = (220, 216, 206)
img[deck & ~nd.binary_erosion(deck)] = (126, 120, 112)
# the HZMB's undersea tunnel heading west to Zhuhai and Macau: a dashed shadow under the water, a dark portal on the island
tl = Image.new('L', (W, H), 0); td = ImageDraw.Draw(tl)
for i in range(0, 74, 4): td.line([((73 - i) * K, (550.9 - i * 0.025) * K), ((73 - i - 2) * K, (550.9 - (i + 2) * 0.025) * K)], fill=255, width=K)
tm = (np.array(tl) > 0) & sea & ~deck; img[tm] = (38, 74, 116)
img[int(551.6 * K):int(553.6 * K), 73 * K:int(74.5 * K)] = (52, 52, 60)
for k, b in BR.items():
    for t in b.get('towers', []):
        x, y = along(b['pts'], t); x, y = int(x * K), int(y * K)
        img[y - 2*K:y + 1*K, x - K:x + K] = (84, 84, 94); img[y - 2*K:y - 2*K + 2, x - K:x + K] = (180, 180, 190)
        img[y + 1*K:y + 2*K, x:x + K + 1] = (40, 80, 122)

# --- reservoirs (OSM water=reservoir), pieces joined into rings ---
pieces = [[tuple(int(v)*K for v in p.split(',')) for p in s.split()] for s in open(HK+"/build"+'/water.txt').read().strip().split(';')]
rings, segs = [], [p for p in pieces]
while segs:
    r = segs.pop(0); guard = 0
    while r[0] != r[-1] and guard < 50:
        guard += 1; hit = False
        for i, s in enumerate(segs):
            if s[0] == r[-1]: r = r + s[1:]; segs.pop(i); hit = True; break
            if s[-1] == r[-1]: r = r + s[::-1][1:]; segs.pop(i); hit = True; break
        if not hit: break
    if r[0] == r[-1] or math.dist(r[0], r[-1]) < 6*K: rings.append(r)
resm = Image.new('L', (W, H), 0); rd = ImageDraw.Draw(resm)
for r in rings: rd.polygon(r, fill=255)
res = np.array(resm) > 0
res &= land
img[res] = PAL['res']
img[res & ~nd.binary_erosion(res)] = PAL['resE']

# --- districts as a raster on the real coastline: baked dotted borders + an index picture for pixel-exact highlights ---
GEOD = json.load(open(HK+"/data"+'/data4.json', encoding='utf-8'))['geo']
def ring_raster(rings):
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    for r in rings:
        if len(r) > 2: d.polygon([(x * K, y * K) for x, y in r], fill=255)
    return np.array(m) > 0
def label(keys):
    lab = np.zeros((H, W), np.int16)
    for i, k in enumerate(keys): lab[ring_raster(GEOD[k]['fill']) & (lab == 0)] = i + 1
    lab[~hk] = 0
    miss = hk & (lab == 0)                                  # land the simplified polygons missed: nearest district
    if miss.any():
        _, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
        lab[miss] = lab[iy[miss], ix[miss]]
    return lab
DK = [k for k in GEOD if k.startswith('D:')]; RK = [k for k in GEOD if k.startswith('R:')]
dl, rl = label(DK), label(RK)
bd = np.zeros((H, W), bool)
bd[:, :-1] |= (dl[:, :-1] != dl[:, 1:]) & (dl[:, :-1] > 0) & (dl[:, 1:] > 0)
bd[:-1, :] |= (dl[:-1, :] != dl[1:, :]) & (dl[:-1, :] > 0) & (dl[1:, :] > 0)
bd = nd.binary_dilation(bd, structure=np.ones((2, 2), bool)) & hk
dots = ((xx // K + yy // K) % 4) < 2
img[bd & dots & ~res] = (150, 118, 78)
Image.fromarray(np.dstack([dl.astype(np.uint8), rl.astype(np.uint8), np.zeros_like(dl, np.uint8)]), 'RGB').save(OUT+'/img/areas.png', optimize=True)
json.dump({**{k: [0, i + 1] for i, k in enumerate(DK)}, **{k: [1, i + 1] for i, k in enumerate(RK)}}, open(HK+"/build"+'/areas.json', 'w'), ensure_ascii=False)

# --- coastline: a darker edge on the land side ---
edge = land & ~nd.binary_erosion(land)
img[edge & hk] = PAL['edge']
img[edge & cn] = PAL['cnedge']

placed = []
print('rings', len(rings), 'mountains', len(placed))

# --- mainland China mask at game resolution, for the animated 'no signal' static drawn in the game ---
cn1 = cn.reshape(H0, K, W0, K).all(axis=(1, 3))
cn1 = nd.binary_erosion(cn1, iterations=1)          # keep the coastline edge from the map visible
Image.fromarray((cn1 * 255).astype(np.uint8), 'L').convert('1').save(OUT+'/img/cn.png', optimize=True)
# --- a deep-sea tile with the same little waves, to carry the sea past the edge of the map ---
T = np.zeros((32 * K, 26 * K, 3), np.uint8); T[:] = PAL['deep']
for (a, b) in ((8, 6), (7, 7), (7, 8), (8, 9)): T[a*K:(a+1)*K, b*K:(b+1)*K] = PAL['wave']
for (a, b) in ((24, 19), (23, 20), (23, 21), (24, 22)): T[a*K:(a+1)*K, (b % 26)*K:((b % 26)+1)*K] = PAL['wave']
Image.fromarray(T, 'RGB').save(OUT+'/img/sea.png', optimize=True)

# --- ferry piers: jetties pointing out to open water, and ferry routes found through the water between their docks ---
import heapq
PIERS = [('CEN7', '中環', 'Jūngwàahn', 'Central (Star Ferry)', 114.1612, 22.2868, (64, 138, 92)), ('CEN', '中環', 'Jūngwàahn', 'Central Piers', 114.1548, 22.2880, (196, 70, 56)),
         ('TST', '尖沙咀', 'Jīmsājéui', 'Tsim Sha Tsui', 114.1686, 22.2938, (64, 138, 92)), ('WAC', '灣仔', 'Wāanjái', 'Wan Chai', 114.1752, 22.2838, (64, 138, 92)),
         ('YSW', '榕樹灣', 'Yùhngsyuhwāan', 'Yung Shue Wan, Lamma', 114.1068, 22.2278, (196, 70, 56)), ('SKW', '索罟灣', 'Sokgūwāan', 'Sok Kwu Wan, Lamma', 114.1325, 22.2088, (196, 70, 56)),
         ('CCH', '長洲', 'Chèuhngjāu', 'Cheung Chau', 114.0305, 22.2095, (196, 70, 56)), ('MUW', '梅窩', 'Mùihwō', 'Mui Wo', 114.0005, 22.2650, (196, 70, 56)),
         ('PEC', '坪洲', 'Pìhngjāu', 'Peng Chau', 114.0410, 22.2860, (196, 70, 56)), ('ABD', '香港仔', 'Hēunggóngjái', 'Aberdeen', 114.1530, 22.2478, (176, 120, 60))]
def water1():
    r, g, b = [img[..., i].astype(int).reshape(H0, K, W0, K) for i in range(3)]
    return ((b > r + 35) & (b >= g)).all(axis=(1, 3))
WT = water1(); DIRS = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
PJ = {}
for pid, hz, yl, en, lo, la, roof in PIERS:
    ax, ay = W1(lo, la); cand = []
    for y in range(ay - 14, ay + 15):
        for x in range(ax - 14, ax + 15):
            if not WT[y, x] and WT[y - 1:y + 2, x - 1:x + 2].any(): cand.append(((x - ax) ** 2 + (y - ay) ** 2, x, y))
    for _, sx, sy in sorted(cand):
        runs = []
        for dx, dy in DIRS:
            n = 0
            while n < 16 and WT[sy + dy * (n + 1), sx + dx * (n + 1)]: n += 1
            runs.append((min(n, 12) - (0.6 if dx and dy else 0), dx, dy, n))
        sc, dx, dy, n = max(runs)
        if n >= 7: break
    Lj = max(2, min(4, n - 4))
    cells = [(sx + dx * i, sy + dy * i) for i in range(1, Lj + 1)]
    wide = cells + [(x - dy if not (dx and dy) else x + 1, y + dx if not (dx and dy) else y) for x, y in cells]
    for x, y in wide: img[y * K:(y + 1) * K, x * K:(x + 1) * K] = (206, 196, 178)
    for x, y in wide:                                                   # a darker rim where the deck meets the water
        for ox, oy in DIRS:
            if WT[y + oy, x + ox] and (x + ox, y + oy) not in wide: img[(y + oy) * K:(y + oy + 1) * K, (x + ox) * K:(x + ox + 1) * K] = (40, 78, 118)
    ex, ey = cells[-1]; img[ey * K:(ey + 1) * K + K // 2, ex * K - K // 2:(ex + 1) * K + K // 2] = roof    # the little terminal roof at the end
    img[ey * K + K:(ey + 1) * K + K // 2, ex * K - K // 2:(ex + 1) * K + K // 2] = tuple(int(c * 0.7) for c in roof)
    PJ[pid] = dict(hz=hz, yale=yl, en=en, land=[ex + 0.5, ey + 0.5], dock=[sx + dx * (Lj + 2.5) + 0.0, sy + dy * (Lj + 2.5) + 0.0], dir=[dx, dy])
WT = water1(); CL = nd.distance_transform_edt(WT)
for k, v in PJ.items(): print('pier', k, v['land'], v['dock'], v['dir'], bool(WT[int(v['dock'][1]), int(v['dock'][0])]))
np.save('/tmp/WT.npy', WT)
def astar(a, b):
    a, b = (int(a[0]), int(a[1])), (int(b[0]), int(b[1])); g = {a: 0}; prev = {}; pq = [(0, a)]
    while pq:
        _, u = heapq.heappop(pq)
        if u == b: break
        for dx, dy in DIRS:
            v = (u[0] + dx, u[1] + dy)
            if not (0 < v[0] < W0 - 1 and 0 < v[1] < H0 - 1) or not WT[v[1], v[0]]: continue
            c = g[u] + math.hypot(dx, dy) * (1 + 4 / (0.5 + CL[v[1], v[0]]))
            if c < g.get(v, 1e18): g[v] = c; prev[v] = u; heapq.heappush(pq, (c + math.dist(v, b), v))
    p = [b]
    while p[-1] != a: p.append(prev[p[-1]])
    return [(x + 0.5, y + 0.5) for x, y in p[::-1]]
def clear(p, q, c=1.0):
    n = int(math.dist(p, q) * 4) + 1
    return all(CL[int(p[1] + (q[1] - p[1]) * i / n), int(p[0] + (q[0] - p[0]) * i / n)] >= c for i in range(n + 1))
def simplify(p):
    out = [p[0]]; i = 0
    while i < len(p) - 1:
        j = len(p) - 1
        while j > i + 1 and not clear(p[i], p[j], 1.5): j -= 1
        out.append(p[j]); i = j
    return out
def chaikin(p):                                   # round every corner that has room, a corner at a time
    for _ in range(4):
        q = [p[0]]
        for i in range(1, len(p) - 1):
            a, b, c = p[i - 1], p[i], p[i + 1]
            u = (b[0] + (a[0] - b[0]) * .25, b[1] + (a[1] - b[1]) * .25); v = (b[0] + (c[0] - b[0]) * .25, b[1] + (c[1] - b[1]) * .25)
            if clear(q[-1], u, 0.8) and clear(u, v, 0.8) and clear(v, c, 0.8): q += [u, v]
            else: q.append(b)
        q.append(p[-1]); p = q
    return p
SF, DL, KD = ['天星小輪', 'Tīnsīng Síulèuhn', 'Star Ferry'], ['渡輪', 'douhlèuhn', 'ferry to the islands'], ['街渡', 'gāaidouh', 'kaito, a little village ferry']
FR = [('CEN7', 'TST', 'ferry', 22, 2, SF), ('WAC', 'TST', 'ferry', 20, 2, SF), ('CEN', 'CCH', 'fast', 34, 2, DL), ('CEN', 'MUW', 'ferry', 22, 1, DL), ('CEN', 'YSW', 'fast', 30, 2, DL),
      ('CEN', 'SKW', 'fast', 28, 1, DL), ('CEN', 'PEC', 'ferry', 22, 1, DL), ('ABD', 'SKW', 'ferry', 16, 1, KD), ('ABD', 'YSW', 'ferry', 16, 1, KD)]
routes = []
for a, b, tex, sp, nb, word in FR:
    pa, pb = PJ[a]['dock'], PJ[b]['dock']; path = chaikin(simplify(astar(pa, pb)))
    path = [tuple(pa)] + path[1:-1] + [tuple(pb)]
    routes.append(dict(a=a, b=b, tex=tex, sp=sp, n=nb, word=word, path=[[round(x, 2), round(y, 2)] for x, y in path]))
    print('route', a, b, len(path))
json.dump(dict(piers=PJ, routes=routes), open(HK+"/build"+'/ferries.json', 'w'), ensure_ascii=False)

out = Image.fromarray(img, 'RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
out.save(OUT+'/img/map.png', optimize=True)
Image.fromarray(img, 'RGB').crop((900, 500, 1900, 1200)).save('/tmp/map_zoom.png')
Image.fromarray(img, 'RGB').save('/tmp/map_full.png')
print('#%02x%02x%02x' % PAL['deep'])
