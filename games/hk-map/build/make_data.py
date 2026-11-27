import json, os
import os as _os
HK = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))          # games/hk-map
OUT = _os.path.join(HK, "..", "..", "public", "games", "hk-map")              # the built game the arcade serves
EXT = _os.environ.get("HKMAP_EXTERNAL", "/home/claude/hkmap-external")       # big map-rendering inputs not kept in the repo (see README)
d=json.load(open(HK+"/data"+'/data4.json',encoding='utf-8'))
ph=json.load(open(HK+"/data"+'/photos4.json',encoding='utf-8'))
CATP={'天星碼頭':'boat','鐘樓':'tower','香港太空館':'museum','香港藝術館':'museum','香港歷史博物館':'museum','香港文化中心':'museum','諾士佛臺':'lantern','星光大道':'star','玉器市場':'lantern','天后廟':'temple','廟街':'lantern','女人街':'lantern','花園街':'lantern','花墟':'tree','怪獸大廈':'tower','維多利亞公園':'tree','香港會議展覽中心':'tower','金紫荊廣場':'star','蘭桂坊':'lantern','蘇豪區':'lantern','文武廟':'temple','山頂':'peak','香港杜莎夫人蠟像館':'museum','青馬大橋':'star','黃大仙祠':'temple','鯉魚門':'boat','香港黃金海岸':'beach','西貢':'boat','車公廟':'temple','大嶼山':'peak','寶蓮寺':'temple','天壇大佛':'temple','大澳':'boat','香港迪士尼樂園':'star','赤柱':'beach','淺水灣':'beach','海洋公園':'star','長洲':'boat','南丫島':'boat'}
CATX={'X:HARBOUR':'boat','X:CUHK':'museum','X:TAIKWUN':'museum','X:WKCD':'museum','X:PALACE':'museum','X:CHILIN':'temple','X:10KBUDDHA':'temple','X:LIONROCK':'peak','X:TAIMOSHAN':'peak','X:DRAGON':'peak','X:WETLAND':'tree','X:MAIPO':'tree','X:NP360':'star','X:PEAKTRAM':'star','X:HVRACE':'star','X:WALLED':'tree','X:KTSP':'star','X:ZOO':'tree','X:BOC':'tower','X:ICC':'tower','X:PINGSHAN':'temple','X:WISHING':'tree','X:ABERDEEN':'boat','X:HIGHISLAND':'tree'}
cat={}
for i in d['items']:
    if i['t']=='p': cat[i['k']]=CATX.get(i['k']) or CATP.get(i['hz']) or 'star'
miss=[i['hz'] for i in d['items'] if i['t']=='p' and i['k'] not in CATX and i['hz'] not in CATP]
print('uncategorised',miss)
import sys; sys.path.insert(0,HK+"/data"); import more as MORE_
for i in d['items']:
    if i['k'] in MORE_.NAME: i['nm']=MORE_.NAME[i['k']]
    if i['k'] in MORE_.MORE: i['more']=MORE_.MORE[i['k']]
# photo galleries (Wikipedia articles' Commons photos); for stations the first neighbourhood photo replaces the platform photo
gal={}
if os.path.exists(HK+"/build"+'/gallery.json'):
    G=json.load(open(HK+"/build"+'/gallery.json',encoding='utf-8'))
    for k,lst in G.items():
        lst=[['https://thumb.wikimedia.org/wikipedia/commons/thumb/'+u,a or 'unknown',l] for u,a,l in lst]
        cur=ph.get(k)
        if cur: lst=[x for x in lst if x[0].split('/')[-2]!=cur['u'].split('/')[-2]]
        if not lst: continue
        if k.startswith('S:') and cur:
            ph[k]={'u':lst[0][0],'by':lst[0][1],'lic':lst[0][2]}; lst=lst[1:]+[[cur['u'],cur['by'],cur['lic']]]
        gal[k]=lst[:3]
d['areaIdx']=json.load(open(HK+"/build"+'/areas.json',encoding='utf-8')); d['ferries']=json.load(open(HK+"/build"+'/ferries.json',encoding='utf-8')); d['cat']=cat; d['sea']='#34628f'
# Anki notes for regions, districts, churches and extra landmarks (added 2026-11-25, tagged hkmap::<key>)
for i in d['items']:
    if not i.get('anki') and i['k'] != 'R:KLN' and (i['t'] in 'rdc' or i['k'].startswith('X:')): i['anki'] = 'tag:hkmap::' + i['k'].replace(':', '-')
# for the arcade's Anki link: which items have Anki notes, their type, and the Anki search that finds them
os.makedirs(OUT+'/js',exist_ok=True)
json.dump([[i['k'], i['t'], i['anki']] for i in d['items'] if i.get('anki')], open(OUT+'/js/anki-items.json','w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
aud=sorted(os.listdir(OUT+"/audio"))
os.makedirs(OUT+'/js',exist_ok=True)
with open(OUT+'/js/data.js','w',encoding='utf-8') as f:
    f.write('window.HK_GAL='+json.dumps(gal,ensure_ascii=False,separators=(',',':'))+';\n')
    f.write('window.HK_DATA='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n')
    f.write('window.HK_PHOTOS='+json.dumps(ph,ensure_ascii=False,separators=(',',':'))+';\n')
    f.write('window.HK_AUDIO='+json.dumps(aud,ensure_ascii=False,separators=(',',':'))+';\n')
print('data.js',os.path.getsize(OUT+'/js/data.js')//1024,'KB', len(aud),'audio')
# icons
names='flag target zap human book-open map settings-cog fire upload download play close lock home volume-3 lightbulb check plus minus arrow-right search map-pin music copy more-horizontal gamepad reload trophy coffee'.split()
ic={}
for n in names:
    s=open((HK+"/vendor/icons"+f'/{n}.svg')).read().strip()
    ic[n]=s.replace('<svg ','<svg aria-hidden="true" ')
open(OUT+'/js/icons.js','w').write('window.HK_ICONS='+json.dumps(ic)+';\n')
print('icons',len(ic))
