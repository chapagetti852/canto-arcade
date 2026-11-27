"""Subset the 12px pixel fonts (Fusion Pixel, vendor/font-zh, OFL) to every character the game uses,
into assets/fp.woff2. Vite inlines it into index.html at build. Run after adding Chinese or Yale text:
`npm run fonts -w games/hk-map` (or `npm run hkmap` from the repo root)."""
import glob, io, os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
HK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # games/hk-map
text = open(HK + '/index.html', encoding='utf-8').read() + open(HK + '/public/js/data.js', encoding='utf-8').read()
for f in glob.glob(HK + '/src/**/*.[jt]s', recursive=True): text += open(f, encoding='utf-8').read()
chars = set(c for c in text if ord(c) >= 32) | set(chr(i) for i in range(32, 127))
D = HK + '/vendor/font-zh/'
need = {}; got = set()
for f in sorted(glob.glob(D + '*.woff2')):
    cm = TTFont(f).getBestCmap(); have = [c for c in chars if ord(c) in cm and c not in got]
    if have: need[f] = have; got |= set(have)
print('missing:', ''.join(sorted(c for c in chars - got if ord(c) < 0x1f000 and not (0x300 <= ord(c) < 0x370))))
parts = []
for f, cs in need.items():
    t = TTFont(f); s = subset.Subsetter(subset.Options()); s.populate(unicodes=[ord(c) for c in cs]); s.subset(t); t.flavor = None
    p = f'/tmp/hkmap-font{len(parts)}.ttf'; t.save(p); parts.append(p)
font = Merger().merge(parts); font.flavor = 'woff2'; b = io.BytesIO(); font.save(b)
os.makedirs(HK + '/assets', exist_ok=True)
open(HK + '/assets/fp.woff2', 'wb').write(b.getvalue())
print('assets/fp.woff2', len(b.getvalue()) // 1024, 'KB')
