import base64, io, glob, json, os, re, time, shutil
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger
import os as _os
HK = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))          # games/hk-map
OUT = _os.path.join(HK, "..", "..", "public", "games", "hk-map")              # the built game the arcade serves
EXT = _os.environ.get("HKMAP_EXTERNAL", "/home/claude/hkmap-external")       # big map-rendering inputs not kept in the repo (see README)
S=HK+"/src"+'/'; O=OUT+'/'
html=open(S+'index.html',encoding='utf-8').read(); app=open(S+'app.js',encoding='utf-8').read().replace('/*__MINIGAMES__*/', open(S+'mini.js',encoding='utf-8').read()); data=open(O+'js/data.js',encoding='utf-8').read()
chars=set(c for c in html+app+data if ord(c)>=32)|set(chr(i) for i in range(32,127))
D=HK+"/vendor/font-zh"+'/'
need={}; got=set()
for f in sorted(glob.glob(D+'*.woff2')):
    cm=TTFont(f).getBestCmap(); have=[c for c in chars if ord(c) in cm and c not in got]
    if have: need[f]=have; got|=set(have)
print('missing:',''.join(sorted(c for c in chars-got if ord(c)<0x1f000 and not (0x300<=ord(c)<0x370))))
parts=[]
for f,cs in need.items():
    t=TTFont(f); s=subset.Subsetter(subset.Options()); s.populate(unicodes=[ord(c) for c in cs]); s.subset(t); t.flavor=None; p=f'/tmp/q{len(parts)}.ttf'; t.save(p); parts.append(p)
font=Merger().merge(parts); font.flavor='woff2'; b=io.BytesIO(); font.save(b)
html=html.replace('__FONT__',base64.b64encode(b.getvalue()).decode()).replace('__FONT2__',base64.b64encode(open(HK+"/vendor/fp2.woff2",'rb').read()).decode())
open(O+'index.html','w',encoding='utf-8').write(html)
v=time.strftime('%Y%m%d%H%M')
open(O+'js/app.js','w',encoding='utf-8').write(app.replace('__BUILD__', v))
sw=open(O+'sw.js').read(); sw=re.sub(r"arcadehk-[^']*'", "arcadehk-"+v+"'", sw, count=1); sw=re.sub(r"'img/map\.png[^']*'", "'img/map.png?v="+v+"'", sw); open(O+'sw.js','w').write(sw)
tot=sum(os.path.getsize(os.path.join(dp,f)) for dp,dn,fn in os.walk(O) for f in fn)
print('index.html',len(html)//1024,'KB · site total',tot//1024,'KB · version',v)
