#!/usr/bin/env python3
"""Builds public/assets/fonts/pixel-zh.woff2: the Fusion Pixel 12px (OFL) glyphs for every
Chinese character used in src/. Rerun after adding Chinese text: `npm run font`."""
import glob, io, os, re
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games', 'hk-map', 'vendor', 'font-zh')
text = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.ts'), recursive=True))
chars = set(c for c in text if ord(c) >= 32) | set('◀▶▲▼·…★☆♪0123456789')
need, got = {}, set()
for f in sorted(glob.glob(os.path.join(SRC, '*.woff2'))):
    cm = TTFont(f).getBestCmap(); have = [c for c in chars if ord(c) in cm and c not in got]
    if have: need[f] = have; got |= set(have)
parts = []
for i, (f, cs) in enumerate(need.items()):
    t = TTFont(f); s = subset.Subsetter(subset.Options()); s.populate(unicodes=[ord(c) for c in cs]); s.subset(t); t.flavor = None
    p = f'/tmp/zh{i}.ttf'; t.save(p); parts.append(p)
font = Merger().merge(parts); font.flavor = 'woff2'
out = os.path.join(ROOT, 'public', 'assets', 'fonts', 'pixel-zh.woff2'); font.save(out)
miss = ''.join(sorted(chars - got))
print(f'pixel-zh.woff2: {len(got)} glyphs, {os.path.getsize(out)} bytes' + (f' · missing: {miss}' if miss else ''))
