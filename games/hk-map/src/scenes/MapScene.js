import Phaser from 'phaser';
import { BY, CAT, DATA, GEO, ITEMS, LINES, isArea } from "../core/util.js";
import { sfx } from "../audio/music.js";
import { insets, toast } from "../ui/dom.js";
import { lineBounds } from "../map/geo.js";
import { G } from "../game/G.js";
import { mastered, stars } from "../core/state.js";

// ---------- the map (Phaser) ----------
let MAP = null;
const MARK_INK = 0x241a12;
class MapScene extends Phaser.Scene {
  constructor() { super('map'); }
  preload() { this.load.image('map', 'img/map.png?v=__BUILD__'); this.load.image('cnmask', 'img/cn.png?v=__BUILD__'); this.load.image('seatile', 'img/sea.png?v=__BUILD__'); this.load.image('areas', 'img/areas.png?v=__BUILD__'); }
  create() {
    MAP = this; const cam = this.cam = this.cameras.main;
    cam.setBackgroundColor(DATA.sea || '#3a6c9b'); cam.setBounds(-4000, -4000, DATA.W + 8000, DATA.H + 8000); /* loose: the map must be free to sit above a tall phone menu */
    this.seaT = this.add.tileSprite(-4000, -4000, (DATA.W + 8000) * 2, (DATA.H + 8000) * 2, 'seatile').setOrigin(0).setScale(0.5); /* the sea goes on past the map */
    this.mapImg = this.add.image(0, 0, 'map').setOrigin(0).setDisplaySize(1129, 832); this.filter = null; /* world size, whatever the picture's resolution */
    this.geoG = this.add.graphics(); this.areaG = this.add.graphics(); this.lineG = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false); this.hiG = this.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false); this.amb = this.add.container(0, 0); this.fireC = this.add.container(0, 0);
    this.dl = this.add.container(0, 0); this.mk = this.add.container(0, 0); this.fx = this.add.container(0, 0); this.lb = this.add.container(0, 0);
    this.makeStatic(); this.makeTextures(); try { this.lineTex('lines', Object.keys(LINES), 2, true); this.lineG.setTexture('lines').setDisplaySize(DATA.W, DATA.H).setVisible(true); } catch (e) { console.warn('lines', e); } this.drawGeo(); this.makeMarkers(); this.makeAreaLabels(); this.ambS = 0.5; try { this.makeAmbient(); } catch (e) { console.warn('ambient', e); }
    this.burstEm = this.add.particles(0, 0, 'dot', { lifespan: 650, speed: { min: 12, max: 38 }, angle: { min: 0, max: 360 }, gravityY: 30, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xf6c945, 0xffffff, 0x5cc46a], frequency: -1, maxParticles: 120 });
    this.dustEm = this.add.particles(0, 0, 'dot', { lifespan: 520, speed: { min: 2, max: 6 }, angle: { min: 200, max: 340 }, scale: { start: 0.5, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: [0xcdbb98, 0xb9a682], frequency: -1, maxParticles: 40 });
    this.ripEm = this.add.particles(0, 0, 'rip', { lifespan: 1100, speed: 0, scale: { start: 0.25, end: 0.9 }, alpha: { start: 0.65, end: 0 }, frequency: -1, maxParticles: 24 });
    try { this.vig = this.cam.filters.external.addVignette(0.5, 0.5, 0.92, 0.12); } catch (e) { this.vig = null; } /* a very soft vignette, always on */
    this.lineZ = -1; this.hiLine = null; this.markRule = () => false; this.labelRule = () => false; this.geoMode = 'all'; this.follow = null;
    this.pointers = new Map(); this.input.addPointer(2); this.drag = false; this.onTap = null;
    this.input.on('pointerdown', p => { this.pointers.set(p.id, { x: p.x, y: p.y, x0: p.x, y0: p.y, t: performance.now() }); if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; a.multi = b.multi = true; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.zoom }; } });
    this.input.on('pointermove', p => {
      const q = this.pointers.get(p.id); if (!q || !p.isDown) return; const dx = p.x - q.x, dy = p.y - q.y; q.x = p.x; q.y = p.y;
      if (this.pointers.size >= 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, this.pinch.z * d / this.pinch.d / this.cam.zoom); return; }
      if (this.drag && Math.hypot(p.x - q.x0, p.y - q.y0) > 6) { this.cam.scrollX -= dx / this.cam.zoom; this.cam.scrollY -= dy / this.cam.zoom; this.follow = null; }
    });
    const up = p => { const q = this.pointers.get(p.id); this.pointers.delete(p.id); if (this.pointers.size < 2) this.pinch = null; if (!q || q.multi) return; /* a finger lifted after a pinch is not a tap */ if (Math.hypot(p.x - q.x0, p.y - q.y0) < 9 && performance.now() - q.t < 450) { const w = this.cam.getWorldPoint(p.x, p.y); if (this.ambHit(w)) return; if (this.onTap) this.onTap(w, p); } };
    this.input.on('pointerup', up); this.input.on('pointerupoutside', up);
    this.input.on('wheel', (p, o, dx, dy) => { if (this.drag || this.wheelOK) this.zoomAt(p.x, p.y, dy > 0 ? 0.87 : 1.15); });
    this.scale.on('resize', () => { this.lineZ = -1; if (this.lastFit) this.fit(this.lastFit.b, Object.assign({}, this.lastFit.o, { dur: 0 })); });
    G.boot();
  }
  // --- textures: markers, icons, vehicles, tourist ---
  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const draw = (rows, pal, key) => { rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && pal[ch] != null) { g.fillStyle(pal[ch], 1); g.fillRect(x, y, 1, 1); } })); g.generateTexture(key, rows[0].length, rows.length); g.clear(); };
    draw(['..kkkk..', '.kkrrkk.', 'kkrrrrkk', 'kkrwwrkk', 'kkrwwrkk', '.kkrrkk.', '..kkkk..', '...kk...', '...kk...'], { k: 0x2a0a08, r: 0xe8463c, w: 0xffffff }, 'pin');
    draw(['kkkkk', 'kwwwk', 'kwwwk', 'kwwwk', 'kkkkk'], { k: MARK_INK, w: 0xffffff }, 'st');
    draw(['kkkkkkk', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', 'kkkkkkk'], { k: MARK_INK, w: 0xffffff }, 'st2');
    draw(['kkkkk', 'kgggk', 'kgggk', 'kgggk', 'kkkkk'], { k: MARK_INK, g: 0x5cc46a }, 'stm');
    draw(['kkkkkkk', 'kgggggk', 'kgggggk', 'kgggggk', 'kkkkkkk'], { k: MARK_INK, g: 0x5cc46a }, 'st2m');
    draw(['.kkk.', 'kwwwk', 'kwkwk', 'kwwwk', '.kkk.'], { k: 0x6b6150, w: 0xd8cfb8 }, 'unk');
    const ICON = {
      star: ['....k....', '...kfk...', '...kfk...', 'kkkkfkkkk', 'kfffffffk', '.kfffffk.', '..kfffk..', '.kfkkkfk.', 'kk.....kk'],
      temple: ['....k....', '..kkfkk..', 'kkfffffkk', '.kkkkkkk.', '..kfkfk..', '..kfkfk..', '.kkkkkkk.', '.kfffffk.', 'kkkkkkkkk'],
      cross: ['...kkk...', '...kfk...', 'kkkkfkkkk', 'kfffffffk', 'kkkkfkkkk', '...kfk...', '...kfk...', '...kfk...', '...kkk...'],
      museum: ['....k....', '..kkfkk..', 'kkfffffkk', 'kkkkkkkkk', 'kfkfkfkfk', 'kfkfkfkfk', 'kfkfkfkfk', 'kkkkkkkkk', 'kfffffffk'],
      tree: ['...kkk...', '..kfffk..', '.kfffffk.', 'kfffffffk', 'kfffffffk', '.kfffffk.', '..kkwkk..', '....w....', '...kwk...'],
      peak: ['....k....', '...kwk...', '..kwwfk..', '..kfffk..', '.kfffffk.', '.kfffffk.', 'kfffffffk', 'kfffffffk', 'kkkkkkkkk'],
      lantern: ['...kkk...', '..kkkkk..', '.kfffffk.', 'kfwfffffk', 'kfwfffffk', 'kfffffffk', '.kfffffk.', '..kkkkk..', '...kfk...'],
      beach: ['....k....', '..kfwfk..', '.kfwfwfk.', 'kfwfwfwfk', 'kkkkkkkkk', '....k....', '....k....', '....k....', '..kkk....'],
      boat: ['....k....', '....kw...', '....kww..', '....kwww.', '....k....', 'kkkkkkkkk', '.kfffffk.', '..kkkkk..', '.........'],
      tower: ['....k....', '...kfk...', '...kfk...', '..kfwfk..', '..kfwfk..', '..kfffk..', '.kffwffk.', '.kffwffk.', 'kkkkkkkkk'],
    };
    const COL = { star: 0xe0a020, temple: 0xd04a38, cross: 0x8e44ad, museum: 0x2a7a8c, tree: 0x4f9a4a, peak: 0x7a9a5a, lantern: 0xe05a3a, beach: 0xf08a30, boat: 0x8a5a3a, tower: 0x5a7ab0 };
    for (const [k, rows] of Object.entries(ICON)) { draw(rows, { k: MARK_INK, f: COL[k], w: k === 'tree' ? 0x8a5a3a : 0xffffff }, 'i_' + k); draw(rows, { k: 0x6b6150, f: 0xc8bfa8, w: 0xe8e0cc }, 'g_' + k); }
    draw(['kkkkkkkkkkkkkk', 'krrrrrrrrrrrrk', 'kccccccccccccc', 'krwwrwwrwwrwwk', 'krwwrwwrwwrwwk', 'krrrrrrrrrrrrk', 'kkddkkkkkkddkk', '..dd......dd..'], { k: 0x111111, r: 0xe8463c, c: 0xf4e9c8, w: 0x9fd3ff, d: 0x222222 }, 'bus');
    const TOUR = { pal: { h: 0xe6c15a, H: 0xb8902e, s: 0xf2c79b, e: 0x2b1a10, r: 0xe8463c, w: 0xfff1d6, k: 0x1c1c22, b: 0x3a5fb0, d: 0x3a2a1a },
      top: ['....hhhh....', '...hhhhhh...', '.HHHHHHHHHH.', '....ssss....', '....eses....', '....ssss....', '...rrrrrr...', '..rrwrrwrrs.', '..skkkkrrs..', '...rkkkrr...', '...bbbbbb...'], a: ['...bb..bb...', '...ss..ss...', '...dd..dd...'], b: ['..bb....bb..', '..ss....ss..', '..dd....dd..'] };
    draw([...TOUR.top, ...TOUR.a], TOUR.pal, 'tour0'); draw([...TOUR.top, ...TOUR.b], TOUR.pal, 'tour1');
    // a little junk 帆船 for the sea: bow to the left like the walker, battened red-brown sails
    const JUNK = ['.........k..........', '........krk.........', '.......krrrk....k...', '......kllllk...krk..', '.......krrrrk.krrrk.', '......klllllkkllllk.',
      '.......krrrrk.krrk..', '..hhh.kllllllkllllk.', '.hhhhh..k......k....', '..sss...k......k....', 'kkkkkkkkkkkkkkkkkkkk', '.kHHHHHHHHHHHHHHHHk.', '..kHHHHHHHHHHHHHHk..'];
    const JP = { k: 0x2b1a10, r: 0xc0472f, l: 0x7a2e18, h: 0xe6c15a, s: 0xf2c79b, H: 0x8a5a3a };
    draw([...JUNK, '...ww....ww....ww...'], Object.assign({ w: 0xfff6dc }, JP), 'junk0'); draw([...JUNK, '.....ww....ww....ww.'], Object.assign({ w: 0xfff6dc }, JP), 'junk1');
    // ambient life: boats, planes, black kites (麻鷹), sparkles — all drawn facing right / up
    const BP = { k: 0x1c2430, w: 0xf6f3ea, g: 0x2f8a5a, b: 0x2b3550, r: 0xc0472f, c: 0x2f7fb0, y: 0xd8a830, e: 0x3a9a5a, H: 0x7a2e2e, s: 0x9aa6b4 };
    draw(['...kkkkkk...', '..kwwwwwwk..', '.kwbwbwbwwk.', 'kkkkkkkkkkkk', 'kggggggggggk', '.kkkkkkkkkk.'], BP, 'ferry');
    draw(['......kkkk....', '....kkwbwbkk..', 'kkkkwwwwwwwwkk', 'kwwwwwwwwwwwwk', 'kccccccccccck.', '.kkkkkkkkkkk..'], BP, 'fast');
    draw(['...............kk.', '.kccyyeerccyy.kwk.', '.kccyyeerccyy.kwk.', 'kkkkkkkkkkkkkkkkkk', 'kHHHHHHHHHHHHHHHk.', '.kHHHHHHHHHHHHHk..'], BP, 'ship');
    draw(['......k......', '.....kwk.....', '.....kwk.....', '....kwwwk....', '...kwwwwwk...', '.kkwwwwwwwkk.', 'kwwwwwwwwwwwk', 'kkkkkwwwkkkkk', '.....kwk.....', '.....kwk.....', '....kwrwk....', '...kwrrrwk...', '...kkkkkkk...'], BP, 'plane');
    const KP = { k: 0x3e2a1c, d: 0x7a5a3a, l: 0xa88458 };
    draw(['k.......k', 'kkk...kkk', '.kkdkdkk.', '...kdk...', '...k.k...'], KP, 'kite0');
    draw(['.........', '.kk...kk.', 'k.kdkdk.k', '...kdk...', '...k.k...'], KP, 'kite1');
    draw(['.....kk.....', '.kkkkkkkkkk.', 'kgwgwgwgwgwk', 'kggggggggggk', 'kgwgwgwgwgwk', 'kyyyyyyyyyyk', '.kk......kk.'], { k: 0x1c2430, g: 0x2f7a4a, w: 0xdde8ee, y: 0xf0e2b0 }, 'tram');
    draw(['kkkkkkk', 'krwrwrk', 'krrrrrk', '.k...k.'], { k: 0x1c2430, r: 0xb0302a, w: 0xf6f3ea }, 'ptram');
    draw(['.k.', 'kkk', 'rwr', 'rrr'], { k: 0x30343c, r: 0xd0483a, w: 0xf6f3ea }, 'gond');
    // street life: cars seen from above (pointing up), neon signs, a container crane, neighbours, a cat, street snacks
    draw(['.kk.', 'kwwk', 'krrk', 'krrk', 'kwwk', '.kk.'], { k: 0x1c2430, w: 0xd8e6ee, r: 0xd0342c }, 'car_t');
    draw(['.kk.', 'kwwk', 'kggk', 'kyyk', 'kggk', '.kk.'], { k: 0x1c2430, w: 0xd8e6ee, g: 0x2f9a5a, y: 0xf0e2b0 }, 'car_m');
    draw(['.kkk.', 'kwwwk', 'krrrk', 'kcccc'.slice(0, 4) + 'k', 'krrrk', 'kcccc'.slice(0, 4) + 'k', 'krrrk', 'kwwwk', '.kkk.'], { k: 0x1c2430, w: 0xd8e6ee, r: 0xc8392e, c: 0xf0e8d8 }, 'car_b');
    for (const [n, c] of [['p', 0xff4fa3], ['c', 0x40e8ff], ['y', 0xffd23f], ['g', 0x6dff8a]]) draw(['kkk', 'kxk', 'k.k', 'kxk', 'k.k', 'kxk', 'kkk'], { k: c, x: 0xffffff }, 'neon_' + n);
    draw(['kkkkkkkkk', 'krrrrrrrk', '..k...k..', '..kw.wk..', '..k...k..', '..kw.wk..', '.kk...kk.', 'kk.....kk'], { k: 0x3a3f4a, r: 0xd04a3a, w: 0xf2efe6 }, 'crane');
    // neighbours drawn like the walker (same pixel scale): hair, face, shirt, trousers, shoes
    const NP = { h: 0x2a1c14, g: 0xd8d8d8, s: 0xf2c79b, e: 0x2b1a10, k: 0x1c1c22, d: 0x3a2a1a, n: 0x3a3f58, t: 0x8a6a4a };
    const PERSON = (hair, shirt, pants) => ['...hhhh...', '..hhhhhh..', '..hssssh..', '...eses...', '...ssss...', '..xxxxxx..', '.sxxxxxxs.', '.sxxxxxxs.', '..xxxxxx..', '..pppppp..', '..pp..pp..', '..pp..pp..', '..dd..dd..'].map(r => r.replace(/h/g, hair).replace(/x/g, shirt).replace(/p/g, pants));
    [['h', 'b', 'n'], ['h', 'r', 'k'], ['t', 'e', 'n'], ['h', 'y', 'k'], ['g', 'p', 'n']].forEach(([h, c, p], i) => draw(PERSON(h, c, p), Object.assign({ b: 0x3b78c8, r: 0xd04a3a, e: 0x4f9a5a, y: 0xe8b830, p: 0x8a5ab0 }, NP), 'npc' + i));
    draw(['...gggg....', '..gggggg...', '..gssssg...', '...eses....', '...ssss....', '..pppppp...', '.spppppps..', '.spppppps.t', '..pppppp..t', '..pppppp..t', '..pppppp..t', '...n..n...t', '...d..d...t'], Object.assign({ p: 0x9a5aa8 }, NP), 'popo');
    { // Augustin and his tree house on Lamma, the Aberdeen fisherman, the bird-garden grandpa, tai chi, a mahjong table, Mister Softee
      const X = Object.assign({ K: 0x22263a, b: 0x6a4a2a, w: 0xf4f1ea, v: 0x2c3e78, o: 0xc07a32, O: 0x7a4418, l: 0x4a2c14, y: 0xd8b45a, c: 0x8a8a92, Y: 0xf2d03a, G: 0x4f8a3e, g: 0x6aa84e, r: 0xb8483a, P: 0xb88a5a, q: 0x3a2a24, T: 0x6a4626, L: 0x8a6a3a, f: 0x3f8a5a, m: 0xf6f0e0, B: 0x3d7ad0, p: 0xf28ab0, z: 0x26262c }, NP);
      const AUG = ['...KKKK.....', '..KKKKKK....', '..bssssb....', '...eses.....', '...sbbs.....', '..wvwvwv..l.', '.swvwvwvs.l.', '.ooowvwvsl..', 'oooOoowvl...', 'ooOOooosl...', 'oooooovv....', '..vv..vv....', '..dd..dd....'];
      draw(AUG, X, 'aug0'); draw(AUG.map((r, i) => i === 7 ? '.ooowvwv.l..' : i === 9 ? 'ooOOoooslss.' : r), X, 'aug1');
      draw(['......jjjjjjjj......', '....jjGjjjjjGjjj....', '..jjGjjjjjjjjjjGjj..', '.jjjjjjjjjjjGjjjjjjj', 'jjGjjrrrrrrrrrrjjGjj', 'jjjrrrrrrrrrrrrrrjjj', '.jjjPPPPPPPPPPPPjjj.', '..jjPPqqPPPPPPPPjjj.', '..jjPPqqPPPPPqqPjj..', '...jPPPPPPPPPPPPj...', '....llllllllllll....', '.......TT...L.L.....', '.......TT...LLL.....', '......TTT...L.L.....', '.......TT...LLL.....', '......TTTT..L.L.....', '.....TTTTTT.LLL.....'], Object.assign({ j: 0x5f9e48 }, X), 'thouse');
      draw(['....yy....', '..yyyyyy..', 'yyyyyyyyyy', '..gssssg..', '...eses...', '...ssss...', '..wwwwww..', '.swwwwwws.', '.swwwwwws.', '..wwwwww..', '..nnnnnn..', '..nn..nn..', '..dd..dd..'], X, 'abaak');
      const PB = ['...gggg.......', '..gggggg..cc..', '..gssssg.cccc.', '...eses..c.Yc.', '...ssss..cYYc.', '..wwwwww.cccc.', '.swwwwwwss.c..', '.swwwwwws.....', '..wwwwww......', '..kkkkkk......', '..kk..kk......', '..kk..kk......', '..dd..dd......'];
      draw(PB, X, 'birdpa');
      const TC = ['...hhhh...', '..hhhhhh..', '..hssssh..', '...eses...', '...ssss...', '..mmmmmm..', '.smmmmmms.', '.smmmmmms.', '..mmmmmm..', '..zzzzzz..', '..zz..zz..', '..zz..zz..', '..dd..dd..'];
      draw(TC, X, 'taichi0'); draw(TC.map((r, i) => i === 5 ? 'ssmmmmmmss' : i === 6 ? '..mmmmmm..' : i === 7 ? '..mmmmmm..' : i === 10 ? '.zz...zz..' : i === 11 ? 'zz.....zz.' : i === 12 ? 'dd.....dd.' : r), X, 'taichi1');
      draw(['......hhhh......', '......ssss......', '.....rrrrrr.....', '.hh.ffffffff.hh.', '.ss.fmfmfmff.ss.', 'BBB.ffffffff.yyy', 'BBB.fmfmfmmf.yyy', '.nn.ffffffff.nn.', '....kk....kk....', '.....gggggg.....', '....pppppppp....', '....pppppppp....'], X, 'mjt');
      draw(['...........p....', '..........ppp...', '...........Y....', '..mmmmmmmmmmmmm.', '.mqqmmmmmmmmmmmm', '.mqqmBBBBBBBBBBm', 'mmmmmppppppppppm', 'mmmmmmmmmmmmmmmm', '..zz.......zz...'], X, 'softee'); }
    draw(['o.....o..', 'oo...oo..', 'ooooooo..', 'owoowoo..', '.ooooooo.', '.oo.o.oo.', '.o..o..oo'], { o: 0xe8963a, w: 0x2a2230 }, 'cat');
    const SP = { k: 0x5a3a1c, y: 0xf2c94c, o: 0xe0902c, w: 0xfff4dc, r: 0xc8443a, b: 0x7a4a2a, g: 0x9ac65a, c: 0xd9b48a, p: 0xf5a0c0 };
    draw(['.......', '.kkkkk.', 'kyyyyyk', 'kyoyoyk', '.kkkkk.'], SP, 'snk0');            // tart
    draw(['.kkkkk.', 'koyoyok', 'kyoyoyk', 'koyoyok', '.kkkkk.'], SP, 'snk1');            // bun
    draw(['..w.w..', '.w.w.w.', 'kkkkkkk', 'kcccccc'.slice(0, 6) + 'k', '.kcccck'.slice(0, 6) + '.', '..kkk..'], SP, 'snk2');  // bowl
    draw(['...k...', '..kok..', '..kok..', '..kok..', '..kok..', '...b...', '...b...'], SP, 'snk3');    // skewer
    draw(['.kkkk.', 'kwwwwk', 'kbbbbk', 'kbbbbk', 'kbbbbk', '.kkkk.'], SP, 'snk4');      // cup
    draw(['.kkkk.', 'kppppk', 'kwwwwk', '.kwwk.', '..kk..', '..kk..'], SP, 'snk5');      // cone / dessert
    draw(['.w.', 'www', '.w.'], { w: 0xffffff }, 'spark'); draw(['ww', 'ww'], { w: 0xffffff }, 'dot'); draw(['.wwwww.', 'w.....w', '.wwwww.'], { w: 0xffffff }, 'rip'); draw(['ww'], { w: 0xffffff }, 'foam');
    g.destroy();
    // a few pixel clouds: drawn small and scaled up so they stay blocky
    { const g2 = this.make.graphics({ x: 0, y: 0, add: false }), CP = { w: 0xffffff, s: 0xe4ecf2, d: 0xc8d4de };
      const CL = [['........wwww............', '......wwwwwww...www.....', '..www.wwwwwwwwwwwwwww...', '.wwwwwwwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwwwwwwww', 'swwwwwwwwwwwwwwwwwwwwwws', '.sssswwwwwwwssssswwwsss.', '...dddssssssdddddsssdd..'],
        ['.....www..........', '...wwwwwww.www....', '..wwwwwwwwwwwwww..', 'wwwwwwwwwwwwwwwwww', 'swwwwwwwwwwwwwwwws', '.sssssswwwsssssss.', '..dddddsssdddd....'],
        ['..........wwww..........www....', '...www...wwwwwwww....wwwwwww...', '.wwwwwwwwwwwwwwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwww', 'swwwwwwwwwwwwwwwwwwwwwwwwwwwwws', '.ssssswwwwwwssssswwwwwwwsssss..', '...ddddsssssdddddsssssdddd.....']];
      CL.forEach((rows, n) => { rows.forEach((row, y) => [...row].forEach((ch, x) => { if (CP[ch]) { g2.fillStyle(CP[ch], 1); g2.fillRect(x, y, 1, 1); } })); g2.generateTexture('cloud' + n, rows[0].length, rows.length); g2.clear(); this.textures.get('cloud' + n).setFilter(Phaser.Textures.FilterMode.NEAREST); });
      g2.destroy(); }
  }
  // mainland China: soft, slowly flickering TV static ('no signal'), made once as a few frames
  makeStatic() {
    try {
      const img = this.textures.get('cnmask').getSourceImage(), W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const m = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0; const on = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) if (m[i * 4] > 128) { on[i] = 1; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) return; const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const PAL = [[206, 200, 186], [216, 210, 196], [196, 190, 176], [226, 220, 207], [186, 180, 167], [208, 203, 191]];
      this.staticKeys = [];
      for (let f = 0; f < 4; f++) {
        const key = 'static' + f, ct = this.textures.createCanvas(key, w, h), cx = ct.getContext(), id = cx.createImageData(w, h), d = id.data;
        const band = (f * h / 4 + h / 8) | 0;
        for (let y = 0; y < h; y++) { const glow = Math.max(0, 1 - Math.abs(y - band) / 10) * 10, dim = y % 3 === 0 ? -5 : 0;
          for (let x = 0; x < w; x++) { if (!on[(y + y0) * W + x + x0]) continue; const p = PAL[(Math.random() * PAL.length) | 0], k = (y * w + x) * 4; d[k] = p[0] + glow + dim; d[k + 1] = p[1] + glow + dim; d[k + 2] = p[2] + glow + dim; d[k + 3] = 255; } }
        cx.putImageData(id, 0, 0); ct.refresh(); ct.setFilter(Phaser.Textures.FilterMode.NEAREST); this.staticKeys.push(key);
      }
      this.staticImg = this.add.image(x0, y0, 'static0').setOrigin(0); this.staticF = 0; this.staticT = 0;
      const lbl = this.add.text(x0 + w * 0.42, y0 + h * 0.33, '深圳 Sāmjan', { fontFamily: 'FP, FP2', fontSize: '12px', color: '#8f897a' }).setOrigin(0.5).setAlpha(0.7); this.staticLbl = lbl;
    } catch (e) { this.staticImg = null; }
  }
  // --- ambient life: trains on the MTR, ferries, ships, planes at Chek Lap Kok, black kites, clouds, sea sparkles ---
  makeAmbient() {
    const A = this.amb, WP = (lo, la) => ({ x: (lo - 113.80) * 1850 * Math.cos(22.35 * Math.PI / 180), y: (22.58 - la) * 1850 });
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ambSea = this.add.container(0, 0); this.ambLand = this.add.container(0, 0); this.ambSky = this.add.container(0, 0); A.add([this.ambSea, this.ambLand, this.ambSky]);
    this.boats = []; this.trains = []; this.kites = []; this.clouds = []; this.foams = []; this.planeT = 6000; this.sparkT = 0; this.plane = null;
    // ferries on their real routes, back and forth, with a pause at each pier
    const SF = ['天星小輪', 'Tīnsīng Síulèuhn', 'Star Ferry'], DL = ['渡輪', 'douhlèuhn', 'ferry to the islands'];
    const FD = DATA.ferries || { piers: {}, routes: [] }, PI = FD.piers; this.piers = PI;
    this.ferries = FD.routes.map(r => ({ tex: r.tex, a: r.a, b: r.b, path: r.path.map(([x, y]) => ({ x, y })), ends: [r.a, r.b].map(k => [PI[k].hz, PI[k].yale, PI[k].en, PI[k].land]) }));
    FD.routes.forEach((r, n) => { const F = this.ferries[n]; for (let k = 0; k < r.n; k++) { const s = this.add.image(F.path[0].x, F.path[0].y, r.tex); this.ambSea.add(s); this.boats.push({ s, path: F.path, word: r.word, i: 0, dir: 1, u: 0, sp: r.sp, wait: k * 9000 + Math.random() * 3000, base: 0.42 }); } });
    // container ships wandering the open water, turning away from land
    for (let n = 0; n < 4; n++) { let p; for (let k = 0; k < 200; k++) { p = { x: 60 + Math.random() * (DATA.W - 120), y: 60 + Math.random() * (DATA.H - 120) }; if (this.openSea(p.x, p.y, 14)) break; }
      const s = this.add.image(p.x, p.y, 'ship'); this.ambSea.add(s); this.boats.push({ s, word: ['貨船', 'fosyùhn', 'cargo ship'], wander: true, a: Math.random() * 6.28, sp: 5 + Math.random() * 3, base: 0.5 }); }
    // one train per MTR line, running its segments end to end
    for (const [id, L] of Object.entries(LINES)) { const path = this.linePath(id); if (path.length < 2) continue;
      const s = this.add.image(path[0].x, path[0].y, this.miniTrain(L.color)); this.ambLand.add(s); this.trains.push({ s, id, path, word: ['港鐵', 'Góngtit', 'MTR train'], i: (Math.random() * (path.length - 1)) | 0, dir: 1, u: 0, wait: Math.random() * 3000 }); }
    // the ding-ding trams along Hong Kong Island's north shore
    const tramPath = [[114.1283, 22.2817], [114.1500, 22.2865], [114.1580, 22.2822], [114.1650, 22.2790], [114.1750, 22.2775], [114.1850, 22.2800], [114.2000, 22.2905], [114.2140, 22.2860], [114.2290, 22.2790]].map(p => WP(...p));
    for (let n = 0; n < 2; n++) { const s = this.add.image(tramPath[0].x, tramPath[0].y, 'tram'); this.ambLand.add(s); this.trains.push({ s, id: 'tram', path: tramPath, i: n ? 5 : 1, dir: n ? -1 : 1, u: 0.3, wait: 0, tram: true, word: ['電車', 'dihnchē', 'tram — everyone calls it 叮叮 dīngdīng'] }); }
    // cable lines: the Peak Tram and Ngong Ping 360, with their cars going up and down
    const cg = this.add.graphics(); this.ambLand.add(cg); this.cables = [];
    for (const [pts, tex, n, word] of [[[[114.1594, 22.2776], [114.1545, 22.2745], [114.1500, 22.2712]], 'ptram', 2, ['山頂纜車', 'Sāandéng Laahmchē', 'the Peak Tram, up since 1888']],
      [[[113.9405, 22.2893], [113.9283, 22.2965], [113.9078, 22.2620], [113.9020, 22.2565]], 'gond', 8, ['昂坪360', 'Ngòhngpìhng sāam luhk lìhng', 'Ngong Ping 360 cable car to the Big Buddha']]]) {
      const path = pts.map(p => WP(...p)); cg.lineStyle(0.6, 0x3a3a44, 0.7); cg.beginPath(); cg.moveTo(path[0].x, path[0].y); path.slice(1).forEach(p => cg.lineTo(p.x, p.y)); cg.strokePath();
      const L = path.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
      for (let k = 0; k < n; k++) { const s = this.add.image(path[0].x, path[0].y, tex); this.ambLand.add(s); this.cables.push({ s, path, L, f: k / n, v: tex === 'gond' ? 0.018 : 0.03, word, pair: tex === 'ptram' }); } }
    // bridges you can tap
    this.bridges = [['青馬大橋', 'Chīngmáh Daaihkìuh', 'Tsing Ma Bridge — the double-deck suspension bridge to Lantau', 464, 425, 1], ['汲水門大橋', 'Kāpséuimùhn Daaihkìuh', 'Kap Shui Mun Bridge, Ma Wan to Lantau', 437, 436], ['汀九橋', 'Tīnggáu Kìuh', 'Ting Kau Bridge, three towers', 479, 401],
      ['昂船洲大橋', 'Ngòhngsyùhnjāu Daaihkìuh', 'Stonecutters Bridge, Tsing Yi to Stonecutters Island', 546, 471], ['港珠澳大橋', 'Góngjyūou Daaihkìuh', 'Hong Kong–Zhuhai–Macau Bridge, 55 km over the sea', 150, 547], ['深圳灣公路大橋', 'Sāmjanwāan Gūnglouh Daaihkìuh', 'Shenzhen Bay Bridge', 280, 207]];
    this.harbourTaps = [];
    // the red-sailed junk 鴨靈號 doing slow loops of Victoria Harbour
    { const path = [[114.162, 22.292], [114.172, 22.2885], [114.183, 22.2885], [114.186, 22.292], [114.174, 22.2915], [114.162, 22.2925]].map(p => WP(...p)), s = this.add.image(path[0].x, path[0].y, 'junk0'); this.ambSea.add(s); this.boats.push({ s, path, i: 0, dir: 1, u: 0, sp: 5, wait: 0, base: 0.42, junk: true, word: ['鴨靈號', 'Aaplìhng Houh', 'the Duk Ling, a 1950s red-sail junk'] }); }
    // incense smoke drifting up from the big temples
    this.smoke = this.add.particles(0, 0, 'dot', { lifespan: 2600, speedY: { min: -5, max: -3 }, speedX: { min: -1, max: 1.5 }, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.45, end: 0 }, tint: [0xd8d4cc, 0xbcb6ac], frequency: -1, maxParticles: 60 }); this.ambLand.add(this.smoke);
    this.temples = [[114.1934, 22.3424], [114.1500, 22.2840], [114.1846, 22.3727], [113.9058, 22.2555], [114.1700, 22.3080]].map(p => WP(...p)); this.smokeT = 0;
    // traffic: red taxis, green minibuses and buses wandering the main roads
    this.cars = []; try { const R = this.isRoad.bind(this), spots = [];
      for (let k = 0; k < 30000 && spots.length < 34; k++) { const x = 30 + Math.random() * (DATA.W - 60) | 0, y = 30 + Math.random() * (DATA.H - 60) | 0; if (R(x, y) && !this.isWater(x + 0.5, y + 0.5) || R(x, y)) spots.push({ x, y }); }
      spots.forEach((p, i) => { const tex = i % 5 === 0 ? 'car_b' : i % 3 === 0 ? 'car_m' : 'car_t', s = this.add.image(p.x + 0.5, p.y + 0.5, tex); this.ambLand.add(s);
        this.cars.push({ s, cx: p.x, cy: p.y, nx: p.x, ny: p.y, dx: 1, dy: 0, u: 1, v: tex === 'car_b' ? 5 : 7 + Math.random() * 3, word: tex === 'car_b' ? ['巴士', 'bāsí', 'bus'] : tex === 'car_m' ? ['小巴', 'síubā', 'green minibus (綠 Van luhk wēn)'] : ['的士', 'dīksí', 'red taxi (紅的 hùhngdīk)'] }); }); } catch (e) {}
    // neon signs along Nathan Road and friends, blinking when you zoom in
    this.neons = [[114.1694, 22.3193], [114.1700, 22.3172], [114.1712, 22.3105], [114.1702, 22.3072], [114.1718, 22.3049], [114.1722, 22.2985], [114.1840, 22.2800], [114.1720, 22.2790], [114.1630, 22.3310], [114.1855, 22.2788]].map(([lo, la], i) => {
      const p = WP(lo, la), n = this.add.image(p.x + (i % 2 ? 2 : -2), p.y, 'neon_' + 'pcyg'[i % 4]).setBlendMode(Phaser.BlendModes.ADD); this.ambLand.add(n); return { s: n, ph: Math.random() * 6, word: ['霓虹燈', 'ngàihhùhngdāng', 'neon signs — the glow of old Kowloon'] }; });
    // container cranes on the Kwai Tsing quays
    this.cranes = []; { const a = WP(114.100, 22.366), b = WP(114.140, 22.330), q = [];
      for (let y = a.y; y < b.y; y += 1) for (let x = a.x; x < b.x; x += 1) { const [r, g, bb] = this.rgb(x, y); const box = !this.isWater(x, y) && (Math.abs(r - 206) < 6 && Math.abs(bb - 204) < 6 || (r > 140 && Math.abs(r - g) > 60)); if (box && (this.isWater(x + 2, y) || this.isWater(x - 2, y)) && q.every(o => Math.hypot(o.x - x, o.y - y) > 9)) q.push({ x, y }); }
      q.slice(0, 6).forEach(o => { const c = this.add.image(o.x, o.y, 'crane').setOrigin(0.5, 1); this.ambLand.add(c); this.cranes.push({ s: c, word: ['貨櫃碼頭', 'fogwaih máhtàuh', 'container terminal — once the busiest port in the world'] }); }); }
    if (calm) return;
    // black kites circling over the harbour and the hills
    for (const [lo, la] of [[114.165, 22.290], [114.145, 22.272], [114.187, 22.352], [114.215, 22.300], [114.030, 22.370], [113.930, 22.255]]) { const c = WP(lo, la), sh = this.add.image(c.x, c.y, 'kite0').setTint(0x000000).setAlpha(0.16), s = this.add.image(c.x, c.y, 'kite0'); this.ambSky.add([sh, s]);
      this.kites.push({ s, sh, word: ['麻鷹', 'màhyīng', 'black kite — they soar over the harbour'], c, r: 10 + Math.random() * 16, a: Math.random() * 6.28, w: (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.18), flap: 0, home: { ...c } }); }
    // clouds drifting slowly west to east, with their shadows on the ground
    for (let n = 0; n < 6; n++) { const k = 'cloud' + (n % 3), x = Math.random() * DATA.W, y = 40 + Math.random() * (DATA.H - 80), sh = this.add.image(x + 14, y + 22, k).setTint(0x1c2a3a).setAlpha(0.1).setScale(4), s = this.add.image(x, y, k).setAlpha(0.5).setScale(4); this.ambSky.add([sh, s]); this.clouds.push({ s, sh, v: 1.2 + Math.random() * 1.6 }); }
  }
  ambHit(w) { /* tap a boat, train, kite or plane to learn its word */
    if (!this.amb || !['home', 'roam', 'journey'].includes(G.mode)) return false; const r = (G.mode === 'roam' ? 9 : 16) / this.cam.zoom;
    const all = [...this.cars.map(c => [c.s, c.word]), ...this.neons.filter(n => n.s.visible).map(n => [n.s, n.word]), ...this.cranes.map(c => [c.s, c.word]), ...this.cables.map(c => [c.s, c.word]), ...this.kites.map(k => [k.s, k.word]), ...(this.plane ? [[this.plane.p, this.plane.word]] : []), ...this.boats.map(b => [b.s, b.word]), ...this.trains.map(t => [t.s, t.word])];
    let hit = all.find(([s]) => s.visible && s.alpha > 0.3 && Math.hypot(s.x - w.x, s.y - w.y) < r);
    if (!hit && G.mode !== 'roam') { const b = this.bridges.find(b => !b[5] && Math.hypot(b[3] - w.x, b[4] - w.y) < r * 1.2); if (b) hit = [null, b]; }
    if (!hit) { // easter egg: tap Victoria Harbour three times quickly for fireworks (煙花)
      if (w.x > 575 && w.x < 720 && w.y > 500 && w.y < 545 && this.isWater(w.x, w.y)) { const now = performance.now(); this.harbourTaps = this.harbourTaps.filter(t => now - t < 2500); this.harbourTaps.push(now);
        if (this.harbourTaps.length >= 3) { this.harbourTaps = []; this.fireworks(8); toast('煙花', 'yīnfā', 'fireworks over Victoria Harbour'); return true; } }
      return false; }
    if ((this.ambLast || '') === hit[1][0] && performance.now() - this.ambLastT < 2500) return true; this.ambLast = hit[1][0]; this.ambLastT = performance.now();
    toast(hit[1][0], hit[1][1], hit[1][2]); sfx(({ '電車': 'ding', '港鐵': 'chime', '天星小輪': 'horn', '渡輪': 'horn', '貨船': 'horn', '鴨靈號': 'horn', '飛機': 'whoosh', '啟德': 'whoosh', '麻鷹': 'cry', '的士': 'beep', '小巴': 'beep', '巴士': 'beep', '霓虹燈': 'neon', '貨櫃碼頭': 'clank' })[hit[1][0]] || 'pop'); if (hit[0]) this.pop(hit[0].x, hit[0].y, true, 6); return true;
  }
  pop(x, y, good = true, n = 14) { /* sparks plus a ring where something good (or bad) happened */
    const z = this.cam.zoom; this.burstEm.ops.scaleX.start = this.burstEm.ops.scaleY.start = Phaser.Math.Clamp(2.4 / z, 0.3, 3); this.burstEm.explode(n, x, y);
    const r = this.add.circle(x, y, 2 / z, 0, 0).setStrokeStyle(1.5 / z, good ? 0xf6c945 : 0xe0483c); this.fx.add(r);
    this.tweens.add({ targets: r, radius: 16 / z, alpha: { from: 1, to: 0 }, duration: 500, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }
  ptAt(path, f) { let d = f * path.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
    for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], l = Math.hypot(b.x - a.x, b.y - a.y); if (d <= l) return { x: a.x + (b.x - a.x) * d / l, y: a.y + (b.y - a.y) * d / l }; d -= l; } return path[path.length - 1]; }
  fireworks(n = 6) {
    const C = [0xff5a4a, 0xffd34a, 0x6ad0ff, 0x9aff7a, 0xff8ae0, 0xffffff];
    for (let k = 0; k < n; k++) this.time.delayedCall(k * 380 + Math.random() * 200, () => {
      const x = 590 + Math.random() * 110, y = 498 + Math.random() * 30, c = C[(Math.random() * C.length) | 0], z = this.cam.zoom;
      const em = this.add.particles(x, y, 'spark', { speed: { min: 14, max: 34 }, lifespan: 1300, gravityY: 9, scale: { start: Phaser.Math.Clamp(1.4 / z, 0.3, 1.4), end: 0 }, alpha: { start: 1, end: 0 }, tint: [c, 0xffffff], blendMode: 'ADD', emitting: false });
      this.fireC.add(em); em.explode(36); sfx('pop', 0.6 + Math.random() * 0.5); this.time.delayedCall(1600, () => em.destroy()); });
  }
  openSea(x, y, r) { if (x < 20 || y < 20 || x > DATA.W - 20 || y > DATA.H - 20) return false; for (let a = 0; a < 6.28; a += 0.785) if (!this.isWater(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false; return this.isWater(x, y); }
  wake(x, y) { let f = this.foams.find(f => !f.visible); if (!f) { if (this.foams.length > 60) return; f = this.add.image(0, 0, 'foam'); this.ambSea.add(f); this.foams.push(f); } f.setPosition(x, y).setVisible(true).setAlpha(0.7).setScale(this.ambS); this.tweens.add({ targets: f, alpha: 0, duration: 1400, onComplete: () => f.setVisible(false) }); }
  tickAmb(dt, z) {
    const s = this.ambS = 2 / z /* every sprite: one texel = 2 screen px at any zoom; sizes come from the drawings */, q90 = a => Math.round(a / (Math.PI / 2)) * 90, sec = dt / 1000, hl = this.hiLine;
    const along = (o, sp) => { // move o along o.path at sp px/s, pausing and turning round at the ends (boats) or every stop (trains)
      if (o.wait > 0) { o.wait -= dt; return; }
      const a = o.path[o.i], b = o.path[o.i + o.dir], L = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)); o.u += sp * sec / L;
      if (o.u >= 1) { o.u = 0; o.i += o.dir; if (o.i + o.dir < 0 || o.i + o.dir >= o.path.length) { o.dir *= -1; o.wait = 2500; } else if (o.stops && o.path[o.i].st !== false) o.wait = 700; }
      const p = o.path[o.i], q = o.path[o.i + o.dir] || p; o.s.setPosition(p.x + (q.x - p.x) * o.u, p.y + (q.y - p.y) * o.u); return Math.atan2(q.y - p.y, q.x - p.x);
    };
    for (const t of this.trains) { t.stops = true; const ang = along(t, t.tram ? 5 : 16); if (ang != null) { if (t.tram) t.s.setFlipX(Math.cos(ang) < 0); else this.aim(t.s, ang); }
      t.s.setScale(s).setVisible(t.tram || z > 1.4).setAlpha(hl && hl !== t.id ? 0.25 : 1); }
    if (this.smoke && (this.smokeT += dt) > 300 && z > 1.8) { this.smokeT = 0; for (const t of this.temples) this.smoke.explode(1, t.x + (Math.random() - 0.5), t.y - 1); }
    for (const c of this.cars) { c.u += c.v * sec;
      while (c.u >= 1) { c.u -= 1; c.cx = c.nx; c.cy = c.ny; let best = null, bs = -9;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { if (!ox && !oy) continue; const x = c.cx + ox, y = c.cy + oy; if (!this.isRoad(x, y)) continue; const sc = (ox * c.dx + oy * c.dy) / Math.hypot(ox, oy) + Math.random() * 0.6; if (sc > bs && sc > -0.5) { bs = sc; best = [ox, oy]; } }
        if (!best) { c.dx = -c.dx; c.dy = -c.dy; c.nx = c.cx; c.ny = c.cy; } else { c.dx = best[0]; c.dy = best[1]; c.nx = c.cx + best[0]; c.ny = c.cy + best[1]; } }
      c.s.setPosition(c.cx + (c.nx - c.cx) * c.u + 0.5, c.cy + (c.ny - c.cy) * c.u + 0.5).setAngle(q90(Math.atan2(c.dy, c.dx)) + 90).setScale(s).setVisible(z > 1.3); }
    { const tn = performance.now() / 1000; for (const n of this.neons) { const on = z > 2.1; n.s.setVisible(on); if (on) n.s.setScale(s).setAlpha(Math.sin(tn * 3 + n.ph) > -0.75 ? 0.95 : 0.25); } }
    for (const c of this.cranes) c.s.setScale(s);
    for (const c of this.cables) { c.f = (c.f + c.v * sec * 60 / c.L) % 2; let f = c.f > 1 ? 2 - c.f : c.f; f = c.pair ? 0.5 - 0.5 * Math.cos(f * Math.PI) : f; const p = this.ptAt(c.path, f); c.s.setPosition(p.x, p.y).setScale(s); }
    for (const b of this.boats) {
      b.s.setScale(s);
      if (b.wander) { const ax = b.s.x + Math.cos(b.a) * 16, ay = b.s.y + Math.sin(b.a) * 16; if (!this.openSea(ax, ay, 6)) b.a += 1.2 * sec * (b.turn || (b.turn = Math.random() < 0.5 ? -1 : 1)); else b.turn = 0;
        const nx = b.s.x + Math.cos(b.a) * b.sp * sec, ny = b.s.y + Math.sin(b.a) * b.sp * sec; if (this.openSea(nx, ny, 5)) { b.s.x = nx; b.s.y = ny; } else b.a += 2.5 * sec * (b.turn || 1); b.s.setFlipX(Math.cos(b.a) < 0); }
      else { const ang = along(b, b.sp); if (ang != null) b.s.setFlipX(Math.cos(ang) < 0); if (b.junk) b.s.setTexture(Math.floor(performance.now() / 600) % 2 ? 'junk1' : 'junk0'); }
      if ((b.wt = (b.wt || 0) + dt) > 260 && !(b.wait > 0)) { b.wt = 0; const back = b.s.flipX ? 1 : -1; this.wake(b.s.x + back * 7 * s, b.s.y + 2 * s); }
    }
    // planes: take off from or land on Chek Lap Kok's runways (all heading 073°, the way the wind usually blows)
    if (!this.plane && this.planeT - dt < 0 && Math.random() < 0.2) { /* now and then, a ghost of old Kai Tak: in over Kowloon, the checkerboard turn, down onto the old runway */
      const WP = (lo, la) => ({ x: (lo - 113.80) * 1850 * Math.cos(22.35 * Math.PI / 180), y: (22.58 - la) * 1850 }), path = [[113.97, 22.352], [114.10, 22.343], [114.155, 22.337], [114.172, 22.3345], [114.186, 22.330], [114.196, 22.3255], [114.215, 22.307]].map(p => WP(...p));
      const sh = this.add.image(path[0].x, path[0].y, 'plane').setTint(0x000000).setAlpha(0), p = this.add.image(path[0].x, path[0].y, 'plane').setTint(0xf4e6c8); this.ambSky.add([sh, p]);
      this.plane = { p, sh, kt: true, path, t: 0, word: ['啟德', 'Kái Dāk', 'a ghost of old Kai Tak airport (closed 1998): the famous turn at Checkerboard Hill, just over the rooftops'] }; this.planeT = 1; }
    if (!this.plane && (this.planeT -= dt) < 0) { const R = [[113.89797, 22.29623, 113.93282, 22.30747], [113.89360, 22.30951, 113.93235, 22.32199], [113.88070, 22.32107, 113.91715, 22.33282]][(Math.random() * 3) | 0];
      const WP = (lo, la) => ({ x: (lo - 113.80) * 1850 * Math.cos(22.35 * Math.PI / 180), y: (22.58 - la) * 1850 }), a = WP(R[0], R[1]), b = WP(R[2], R[3]), ux = (b.x - a.x), uy = (b.y - a.y), L = Math.hypot(ux, uy), up = Math.random() < 0.5;
      const sh = this.add.image(a.x, a.y, 'plane').setTint(0x000000).setAlpha(0.2), p = this.add.image(a.x, a.y, 'plane'); this.ambSky.add([sh, p]); p.setAngle(Math.round(Math.atan2(uy, ux) / (Math.PI / 2)) * 90 + 90); sh.setAngle(p.angle);
      this.plane = { p, sh, word: ['飛機', 'fēigēi', up ? 'plane — taking off from 赤鱲角 Cheklaahpgok' : 'plane — landing at 赤鱲角 Cheklaahpgok'], a, d: { x: ux / L, y: uy / L }, L, up, t: 0 }; }
    if (this.plane && this.plane.kt) { const P = this.plane; P.t += dt; const k = Math.min(1, P.t / 20000), f = k * 0.97, p = this.ptAt(P.path, f), q = this.ptAt(P.path, Math.min(1, f + 0.01)), alt = Math.max(0, 1 - k / 0.72);
      P.p.setPosition(p.x, p.y - alt * 14).setScale(s).setAngle(q90(Math.atan2(q.y - p.y, q.x - p.x)) + 90); P.sh.setPosition(p.x + alt * 10, p.y + alt * 6).setScale(s).setAngle(P.p.angle);
      const fade = Math.min(1, k * 8, (1 - k) * 8); P.p.setAlpha(0.85 * fade); P.sh.setAlpha(0.16 * fade);
      if (k >= 1) { P.p.destroy(); P.sh.destroy(); this.plane = null; this.planeT = 14000 + Math.random() * 16000; } }
    else if (this.plane) { const P = this.plane, T = 16000; P.t += dt; const k = P.t / T;
      let dist, alt; if (P.up) { dist = k < 0.35 ? P.L * 0.8 * (k / 0.35) ** 2 : P.L * 0.8 + (k - 0.35) * 900; alt = Math.max(0, (k - 0.3) / 0.7); } else { dist = k < 0.55 ? -420 + k / 0.55 * (420 + P.L * 0.15) : P.L * 0.15 + P.L * 0.6 * (1 - (1 - (k - 0.55) / 0.45) ** 2); alt = Math.max(0, 1 - k / 0.55); }
      const x = P.a.x + P.d.x * dist, y = P.a.y + P.d.y * dist, ps = s; P.p.setPosition(x, y - alt * 14).setScale(ps); P.sh.setPosition(x + alt * 10, y + alt * 6).setScale(ps * (1 - alt * 0.3)).setAlpha(0.2 * (1 - alt * 0.6));
      const fade = P.up ? Math.min(1, (1 - k) * 6) : Math.min(1, k * 8, (1 - k) * 8); P.p.setAlpha(fade); P.sh.setAlpha(P.sh.alpha * fade);
      if (k >= 1) { P.p.destroy(); P.sh.destroy(); this.plane = null; this.planeT = 14000 + Math.random() * 16000; } }
    for (const k of this.kites) { k.a += k.w * sec; if (Math.random() < sec * 0.05) { k.c.x = k.home.x + (Math.random() - 0.5) * 30; k.c.y = k.home.y + (Math.random() - 0.5) * 20; }
      k.cx = (k.cx ?? k.c.x) + (k.c.x - (k.cx ?? k.c.x)) * sec * 0.3; k.cy = (k.cy ?? k.c.y) + (k.c.y - (k.cy ?? k.c.y)) * sec * 0.3;
      const x = k.cx + Math.cos(k.a) * k.r, y = k.cy + Math.sin(k.a) * k.r * 0.8, head = k.a + Math.sign(k.w) * Math.PI / 2;
      if (k.flap > 0) k.flap -= dt; else if (Math.random() < sec * 0.25) k.flap = 900; const tex = k.flap > 0 && Math.floor(k.flap / 150) % 2 ? 'kite1' : 'kite0';
      const kr = Phaser.Math.DegToRad(q90(head + Math.PI / 2)); k.s.setTexture(tex).setPosition(x, y).setScale(s).setRotation(kr); k.sh.setTexture(tex).setPosition(x + 9, y + 12).setScale(s).setRotation(kr); }
    const ca = Phaser.Math.Clamp((2.4 - z) / 1.2, 0, 1); for (const c of this.clouds) { c.s.x += c.v * sec; if (c.s.x > DATA.W + 120) { c.s.x = -120; c.s.y = 40 + Math.random() * (DATA.H - 80); } c.sh.setPosition(c.s.x + 14, c.s.y + 22); c.s.setAlpha(0.42 * ca).setVisible(ca > 0); c.sh.setAlpha(0.09 * ca).setVisible(ca > 0); }
    // sea sparkles: a few twinkles in view
    if (this.kites.length && (this.sparkT += dt) > 180) { this.sparkT = 0; const v = this.cam.worldView, x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
      if (this.isWater(x, y) && this.isWater(x + 4, y) && this.isWater(x - 4, y)) { const f = this.add.image(x, y, 'spark').setScale(s).setAlpha(0); this.ambSea.add(f); this.tweens.add({ targets: f, alpha: { from: 0, to: 0.8 }, duration: 260, yoyo: true, onComplete: () => f.destroy() }); } }
  }
  rgb(x, y) { if (!this.px) this.isWater(0, 0); const d = this.px; x = Math.floor(x); y = Math.floor(y); if (!d || x < 0 || y < 0 || x >= DATA.W || y >= DATA.H) return [0, 0, 0]; const i = (y * DATA.W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; }
  isRoad(x, y) { const [r, g, b] = this.rgb(x, y); return (Math.abs(r - 232) < 8 && Math.abs(g - 156) < 8 && Math.abs(b - 98) < 8) || (Math.abs(r - 250) < 4 && Math.abs(g - 246) < 4 && Math.abs(b - 236) < 4) || (Math.abs(r - 220) < 4 && Math.abs(g - 216) < 4 && Math.abs(b - 206) < 4); }
  isUrban(x, y) { const [r, g, b] = this.rgb(x, y); return r >= 170 && r <= 228 && r - b >= 14 && r - b <= 32 && g - b >= 8 && g - b <= 20; }
  areaVal(x, y, ch) {
    if (!this.areaPx) { try { const im = this.textures.get('areas').getSourceImage(), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); this.areaPx = { d: g.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height }; } catch (e) { return 0; } }
    const { d, w, h } = this.areaPx, S = w / DATA.W, px = Math.round(x * S), py = Math.round(y * S), at = (a, b) => a >= 0 && b >= 0 && a < w && b < h ? d[(b * w + a) * 4 + ch] : 0;
    let v = at(px, py); if (v) return v;
    for (let r = 1; r <= 6 * S; r++) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; v = at(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r)); if (v) return v; }
    return 0;
  }
  // is this spot of the map water? (read from the map picture itself: blues are sea and reservoirs)
  isWater(x, y) {
    if (x < 0 || y < 0 || x >= DATA.W || y >= DATA.H) return true;
    if (!this.water) { // read the map picture once (a per-frame getPixel stalls the GPU on phones)
      try { const im = this.textures.get('map').getSourceImage(), c = document.createElement('canvas'); c.width = DATA.W; c.height = DATA.H; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, DATA.W, DATA.H); const d = g.getImageData(0, 0, DATA.W, DATA.H).data; this.px = d; this.water = new Uint8Array(DATA.W * DATA.H); for (let i = 0; i < this.water.length; i++) this.water[i] = d[i * 4 + 2] > d[i * 4] + 35 && d[i * 4 + 2] >= d[i * 4 + 1] ? 1 : 0; } catch (e) { this.water = new Uint8Array(1); }
    }
    return this.water.length > 1 ? !!this.water[Math.floor(y) * DATA.W + Math.floor(x)] : false;
  }
  aim(s, ang) { const d = Math.round(ang / (Math.PI / 4)) * 45; if (Math.abs(d) > 90) s.setFlipX(true).setAngle(d > 0 ? d - 180 : d + 180); else s.setFlipX(false).setAngle(d); } // 8 directions, never upside down
  miniTrain(color) { /* a two-car MTR train at the common pixel scale: white body, line-colour stripe, dark windows */
    const key = 'mt' + color; if (this.textures.exists(key)) return key; const n = parseInt(color.slice(1), 16);
    const rows = ['.kkkkkkkkkk.', 'kwbwbwkwbwbk', 'kccccckccccy', '.kkkkkkkkkk.'], P = { k: 0x1c2430, w: 0xf2f2ee, b: 0x2b3550, c: n, y: 0xffe28a };
    const g = this.make.graphics({ x: 0, y: 0, add: false }); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (P[ch] !== undefined) { g.fillStyle(P[ch], 1); g.fillRect(x, y, 1, 1); } })); g.generateTexture(key, 12, 4); g.destroy(); return key; }
  trainTex(color) {
    const key = 'train' + color; if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ x: 0, y: 0, add: false }), c = Phaser.Display.Color.HexStringToColor(color).color;
    g.fillStyle(0x111111, 1); g.fillRect(0, 0, 18, 9); g.fillStyle(0xf0f0f0, 1); g.fillRect(1, 1, 16, 7); g.fillStyle(c, 1); g.fillRect(1, 5, 16, 2);
    g.fillStyle(0x2b3550, 1); [2, 6, 10].forEach(x => g.fillRect(x, 2, 3, 2)); g.fillStyle(0xffe28a, 1); g.fillRect(16, 2, 1, 2);
    g.generateTexture(key, 18, 9); g.destroy(); return key;
  }
  makeMarkers() {
    for (const it of ITEMS) {
      if (it.t === 'l' || isArea(it)) continue;
      const key = it.t === 's' ? ((it.lines || []).length > 1 ? 'st2' : 'st') : 'i_' + (it.t === 'c' ? 'cross' : CAT[it.k] || 'star');
      const m = this.add.image(it.x, it.y, key); m.it = it; m.base = key; it.m = m; m.setVisible(false); this.mk.add(m);
    }
  }
  makeAreaLabels() {
    for (const it of ITEMS) if (isArea(it)) {
      const big = it.t === 'r', c = this.add.container(it.x, it.y);
      const a = this.add.text(0, 0, it.hz, { fontFamily: 'FP, FP2', fontSize: big ? '24px' : '12px', color: big ? '#3a2a18' : '#5a4630', stroke: '#fbf3dd', strokeThickness: big ? 4 : 3 }).setOrigin(0.5, 1);
      const b = this.add.text(0, 1, it.yale, { fontFamily: 'FP, FP2', fontSize: '12px', color: '#9a6a14', stroke: '#fbf3dd', strokeThickness: 3 }).setOrigin(0.5, 0);
      c.add([a, b]); c.isRegion = big; c.it = it; c.setVisible(false); this.dl.add(c);
    }
  }
  dashed(g, pts, dash, gap) { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0); for (let t = 0; t < L; t += dash + gap) { const e = Math.min(L, t + dash); g.lineBetween(x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L, x0 + (x1 - x0) * e / L, y0 + (y1 - y0) * e / L); } } }
  drawGeo() { this.geoG.clear(); } // district borders are drawn into the map picture itself, on the real coastline
  /* MTR lines as pixel art on the map's own pixel grid (2 per world unit), drawn like railway ticks: a dark casing and a core that alternates the line colour with a lighter shade */
  // Mini Metro-style network: every hop is drawn with horizontal, vertical and 45° runs, and lines sharing a stretch run side by side.
  // Built once, in texture pixels (2 per world px); the drawing, the trains and MTR rides all use these same paths.
  lineGeom() {
    if (this.LG) return this.LG;
    const K = 2, SP = 4, ORD = Object.keys(LINES), P = k => { const o = BY['S:' + k]; return o ? [Math.round(o.x * K), Math.round(o.y * K)] : null; };
    const octo = (A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], ax = Math.abs(dx), ay = Math.abs(dy), m = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
      if (m < 3 || Math.abs(ax - ay) < 3) return [A, B]; const hor = ax > ay, r = (hor ? ax : ay) - m, h = Math.floor(r / 2);
      const p1 = hor ? [A[0] + sx * h, A[1]] : [A[0], A[1] + sy * h], p2 = [p1[0] + sx * m, p1[1] + sy * m]; return h < 2 ? [A, p2, B] : [A, p1, p2, B]; };
    const E = {}; // 'A|B' (A<B) → octilinear points A→B and the lines on it, each with its sideways offset
    for (const id of ORD) for (const seg of LINES[id].seq) for (let i = 1; i < seg.length; i++) { const a = seg[i - 1], b = seg[i]; if (!P(a) || !P(b)) continue; const k = a < b ? a + '|' + b : b + '|' + a; (E[k] = E[k] || { pts: a < b ? octo(P(a), P(b)) : octo(P(b), P(a)), lines: [] }).lines.push({ id, fwd: a < b }); }
    for (const e of Object.values(E)) { const n = e.lines.length, lead = e.lines[0]; e.off = {}; e.lines.forEach((l, k) => { const o = (k - (n - 1) / 2) * SP; e.off[l.id] = lead.fwd ? o : -o; }); } // offset to the left of A→B
    // 1. every line's hops as straight pieces, each with its sideways offset
    const LS = {}, all = [];
    for (const id of ORD) { LS[id] = [];
      for (const seq of LINES[id].seq) { const st = seq.filter(P); if (st.length < 2) continue; const segs = [];
        for (let i = 1; i < st.length; i++) { const a = st[i - 1], b = st[i], e = E[a < b ? a + '|' + b : b + '|' + a], pts = a < b ? e.pts : e.pts.slice().reverse(), off = a < b ? e.off[id] : -e.off[id];
          for (let j = 1; j < pts.length; j++) { const p = pts[j - 1], q = pts[j], L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; const sg = { id, p0: p, q0: q, v: q, L, nx: (q[1] - p[1]) / L, ny: -(q[0] - p[0]) / L, off, b: j === pts.length - 1 ? b : null }; segs.push(sg); all.push(sg); } }
        LS[id].push({ st, segs }); } }
    // 2. different lines running parallel and overlapping (not on a shared hop) get spread into neat lanes, one line-width apart
    for (let it = 0; it < 4; it++) for (let m = 0; m < all.length; m++) for (let n = m + 1; n < all.length; n++) { const A = all[m], B = all[n]; if (A.id === B.id) continue;
      const dot = A.nx * B.nx + A.ny * B.ny; if (Math.abs(Math.abs(dot) - 1) > 0.0004) continue;
      const ax = A.p0[0] + A.nx * A.off, ay = A.p0[1] + A.ny * A.off, ux = -A.ny, uy = A.nx, bpx = B.p0[0] + B.nx * B.off, bpy = B.p0[1] + B.ny * B.off, bqx = B.q0[0] + B.nx * B.off, bqy = B.q0[1] + B.ny * B.off;
      const sep = ((bpx + bqx) / 2 - ax) * A.nx + ((bpy + bqy) / 2 - ay) * A.ny; if (Math.abs(sep) >= SP - 0.5) continue;
      const t0 = (bpx - ax) * ux + (bpy - ay) * uy, t1 = (bqx - ax) * ux + (bqy - ay) * uy, ov = Math.min(A.L, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)); if (ov < SP * 1.5) continue;
      const sg = Math.abs(sep) < 0.01 ? (A.id < B.id ? 1 : -1) : Math.sign(sep), d = (SP - Math.abs(sep)) / 2 * sg; A.off -= d; B.off += d * dot; }
    // 3. join each line's pieces at their corners
    const paths = {}, legs = {};
    for (const id of ORD) { paths[id] = []; legs[id] = {};
      for (const { st, segs: raw } of LS[id]) { const segs = raw.map(g => ({ p: [g.p0[0] + g.nx * g.off, g.p0[1] + g.ny * g.off], q: [g.q0[0] + g.nx * g.off, g.q0[1] + g.ny * g.off], v: g.v, b: g.b }));
        const out = [{ x: segs[0].p[0], y: segs[0].p[1], st: st[0] }];
        for (let i = 0; i < segs.length; i++) { const s0 = segs[i], s1 = segs[i + 1], tag = s0.b || false;
          if (!s1) { out.push({ x: s0.q[0], y: s0.q[1], st: tag }); break; }
          const d0 = [s0.q[0] - s0.p[0], s0.q[1] - s0.p[1]], d1 = [s1.q[0] - s1.p[0], s1.q[1] - s1.p[1]], cr = d0[0] * d1[1] - d0[1] * d1[0];
          let X = null; if (Math.abs(cr) > 1e-6) { const t = ((s1.p[0] - s0.p[0]) * d1[1] - (s1.p[1] - s0.p[1]) * d1[0]) / cr; X = [s0.p[0] + d0[0] * t, s0.p[1] + d0[1] * t]; if (Math.hypot(X[0] - s0.v[0], X[1] - s0.v[1]) > 3 * SP) X = null; }
          if (X) out.push({ x: X[0], y: X[1], st: tag }); else { out.push({ x: s0.q[0], y: s0.q[1], st: false }); out.push({ x: s1.p[0], y: s1.p[1], st: tag }); } }
        paths[id].push(out); const ix = []; out.forEach((p, i) => { if (p.st) ix.push(i); });
        for (let i = 1; i < ix.length; i++) { const a = out[ix[i - 1]].st, b = out[ix[i]].st, part = out.slice(ix[i - 1], ix[i] + 1).map(p => ({ x: p.x / K, y: p.y / K })); legs[id][a + '>' + b] = part; legs[id][b + '>' + a] = part.slice().reverse(); } } }
    return this.LG = { K, paths, legs };
  }
  // the world-coordinate path of a line's longest branch, with st marking stations (for the trains)
  linePath(id) { const G = this.lineGeom(), b = (G.paths[id] || []).reduce((a, p) => p.length > a.length ? p : a, []); return b.map(p => ({ x: p.x / G.K, y: p.y / G.K, st: p.st })); }
  // the fastest way between two stations by MTR (a change of line costs a little), as legs along the drawn lines
  mtrRoute(from, to) {
    const G = this.lineGeom(), adj = {}; for (const [id, L] of Object.entries(G.legs)) for (const [k, pts] of Object.entries(L)) { const [a, b] = k.split('>'); const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0); (adj[a] = adj[a] || []).push({ b, id, len, pts }); }
    const dist = {}, prev = {}, Q = [[0, from, '']]; dist[from + '@'] = 0;
    while (Q.length) { Q.sort((x, y) => x[0] - y[0]); const [d, u, ln] = Q.shift(); if (u === to) { const legs = []; let k = u + '@' + ln; while (prev[k]) { legs.unshift(prev[k].leg); k = prev[k].k; } return legs; }
      if (d > (dist[u + '@' + ln] ?? 1e18)) continue;
      for (const e of adj[u] || []) { const nd = d + e.len + (ln && ln !== e.id ? 40 : 0), k = e.b + '@' + e.id; if (nd < (dist[k] ?? 1e18)) { dist[k] = nd; prev[k] = { k: u + '@' + ln, leg: { id: e.id, a: u, b: e.b, pts: e.pts } }; Q.push([nd, e.b, e.id]); } } }
    return null;
  }
  lineTex(key, ids, core, dashed) {
    const G = this.lineGeom(), c = document.createElement('canvas'); c.width = DATA.W * G.K; c.height = DATA.H * G.K; const g = c.getContext('2d');
    const hex = (h, f, m) => { const n = parseInt(h.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255, t = v => Math.round(m ? v + (255 - v) * f : v * f); return `rgb(${t(r)},${t(gg)},${t(b)})`; };
    // crisp pixel runs: step along the major axis, one column (or row) at a time, thickness measured across the line
    const run = (a, b, w, col, acc) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), xm = Math.abs(dx) >= Math.abs(dy), n = Math.max(1, Math.round(xm ? Math.abs(dx) : Math.abs(dy))), th = Math.max(1, Math.round(w * L / (xm ? Math.abs(dx) : Math.abs(dy)) || w));
      for (let k = 0; k <= n; k++) { const x = a.x + dx * k / n, y = a.y + dy * k / n; g.fillStyle = col(acc + L * k / n); if (xm) g.fillRect(Math.round(x), Math.round(y - th / 2), 1, th); else g.fillRect(Math.round(x - th / 2), Math.round(y), th, 1); } return acc + L; };
    for (const pass of ['case', 'core']) for (const id of ids) { const Lc = LINES[id], w = pass === 'case' ? core + 2 : core, dark = hex(Lc.color, 0.42), light = hex(Lc.color, 0.5, true);
      const col = pass === 'case' ? () => dark : dashed ? d => Math.floor(d / 5) % 2 ? light : Lc.color : () => Lc.color;
      for (const path of G.paths[id] || []) { let acc = 0; for (let i = 1; i < path.length; i++) acc = run(path[i - 1], path[i], w, col, acc); } }
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, c).setFilter(Phaser.Textures.FilterMode.NEAREST); return key;
  }
  drawLines() {
    const z = this.cam.zoom; this.lineG.setAlpha(this.hiLine ? 0.35 : 1);
    if (this.hiLine !== this.hiShown) { this.hiShown = this.hiLine;
      if (this.hiLine && LINES[this.hiLine]) { this.lineTex('lineHi', [this.hiLine], 5, false); this.hiG.setTexture('lineHi').setDisplaySize(DATA.W, DATA.H).setVisible(true); } else this.hiG.setVisible(false); }
    this.drawGeo(); this.lineZ = z;
  }
  highlightLine(id) { this.hiLine = id || null; this.lineZ = -1; }
  // highlight a district or region pixel-for-pixel on the map's own land (from the area index picture)
  highlightArea(k, color = 0xf6c945, alpha = 0.5) {
    this.areaG.clear(); if (this.areaImg) { this.areaImg.destroy(); this.areaImg = null; } if (!k) return;
    const key = 'area_' + k + '_' + color + '_' + alpha;
    if (!this.textures.exists(key)) {
      const idx = DATA.areaIdx && DATA.areaIdx[k]; if (!idx) return;
      if (!this.areaPx) { const im = this.textures.get('areas').getSourceImage(), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); this.areaPx = { d: g.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height }; }
      const { d, w, h } = this.areaPx, [ch, val] = idx, bb = GEO[k].bb, S = w / DATA.W;
      const x0 = Math.max(0, Math.floor((bb[0] - 6) * S)), y0 = Math.max(0, Math.floor((bb[1] - 6) * S)), x1 = Math.min(w - 1, Math.ceil((bb[2] + 6) * S)), y1 = Math.min(h - 1, Math.ceil((bb[3] + 6) * S));
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, ct = this.textures.createCanvas(key, bw, bh), cx = ct.getContext(), id = cx.createImageData(bw, bh), o = id.data;
      const fr = (color >> 16) & 255, fg = (color >> 8) & 255, fb = color & 255, er = color === 0xf6c945 ? 0xb0 : fr * 0.6, eg = color === 0xf6c945 ? 0x7a : fg * 0.6, eb = color === 0xf6c945 ? 0x10 : fb * 0.6;
      const inA = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + ch] === val;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (!inA(x, y)) continue; const edge = !inA(x - 1, y) || !inA(x + 1, y) || !inA(x, y - 1) || !inA(x, y + 1) || !inA(x - 2, y) || !inA(x + 2, y) || !inA(x, y - 2) || !inA(x, y + 2), q = ((y - y0) * bw + x - x0) * 4;
        if (edge) { o[q] = er; o[q + 1] = eg; o[q + 2] = eb; o[q + 3] = 255; } else { o[q] = fr; o[q + 1] = fg; o[q + 2] = fb; o[q + 3] = Math.round(alpha * 255); } }
      cx.putImageData(id, 0, 0); ct.refresh(); ct.setFilter(Phaser.Textures.FilterMode.NEAREST); this.areaPos = this.areaPos || {}; this.areaPos[key] = [x0 / S, y0 / S, S];
    }
    const [px, py, S] = this.areaPos[key]; this.areaImg = this.add.image(px, py, key).setOrigin(0).setScale(1 / S); try { this.children.moveAbove(this.areaImg, this.areaG); } catch (e) { this.areaImg.setDepth(0); }
  }
  // --- camera ---
  fit(b, o = {}) {
    this.lastFit = { b, o }; const ins = insets(), W = this.scale.width, H = this.scale.height, pad = o.pad == null ? 28 : o.pad;
    const vw = Math.max(80, W - ins.left - ins.right - pad * 2), vh = Math.max(80, H - ins.top - ins.bottom - pad * 2);
    const bw = Math.max(16, b[2] - b[0]), bh = Math.max(16, b[3] - b[1]);
    const z = Phaser.Math.Clamp(Math.min(vw / bw, vh / bh), o.minZ || 0.25, o.maxZ || 5);
    const cx = ins.left + pad + vw / 2, cy = ins.top + pad + vh / 2;
    const mx = (b[0] + b[2]) / 2 + (W / 2 - cx) / z, my = (b[1] + b[3]) / 2 + (H / 2 - cy) / z;
    const dur = o.dur == null ? 700 : o.dur; this.follow = null;
    if (!dur) { this.cam.setZoom(z); this.cam.centerOn(mx, my); } else { this.cam.pan(mx, my, dur, 'Sine.easeInOut', true); this.cam.zoomTo(z, dur, 'Sine.easeInOut', true); }
  }
  fitAll(o = {}) { this.fit([60, 40, DATA.W - 60, DATA.H - 60], Object.assign({ pad: 10 }, o)); }
  fitItem(it, o = {}) { if (isArea(it)) return this.fit(GEO[it.k].bb, Object.assign({ maxZ: it.t === 'r' ? 2 : 4 }, o)); if (it.t === 'l') return this.fit(lineBounds(it.k.slice(2)), Object.assign({ maxZ: 3 }, o)); const r = o.r || 45; this.fit([it.x - r, it.y - r * 0.7, it.x + r, it.y + r * 0.7], Object.assign({ maxZ: 4.5 }, o)); }
  zoomAt(sx, sy, f) { const cam = this.cam, before = cam.getWorldPoint(sx, sy); cam.setZoom(Phaser.Math.Clamp(cam.zoom * f, 0.25, 8)); const after = cam.getWorldPoint(sx, sy); cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y; this.lastFit = null; }
  zoomBy(f) { this.zoomAt(this.scale.width / 2, this.scale.height / 2, f); }
  shake() { this.cam.shake(140, 0.004); }
  followSprite(spr) { this.follow = spr; }
  // --- markers & labels ---
  setRules(mark, label) { this.markRule = mark || (() => false); this.labelRule = label || (() => false); this.refresh(); }
  refresh() {
    for (const it of ITEMS) { const m = it.m; if (!m) continue; const v = this.markRule(it); m.setVisible(!!v); if (!v) continue; const s = stars(it);
      if (it.t === 's') m.setTexture(s === 3 ? (m.base === 'st2' ? 'st2m' : 'stm') : m.base); else m.setTexture(s ? m.base : 'g_' + m.base.slice(2)); m.faint = v === 'faint'; m.setAlpha(m.faint ? 0.45 : 1); }
    this.lb.removeAll(true);
    for (const it of ITEMS) { if (!it.m || !this.labelRule(it)) continue; const t = this.add.text(it.x, it.y, it.hz, { fontFamily: 'FP, FP2', fontSize: '12px', color: mastered(it) ? '#1f6b2a' : '#241a12', stroke: '#fbf3dd', strokeThickness: 3 }).setOrigin(0.5, 1); t.it = it; this.lb.add(t); }
    this.lz = -1;
  }
  clearFx() { this.fx.removeAll(true); this.highlightArea(null); this.highlightLine(null); this.follow = null; }
  pin(it) { const p = this.add.image(it.x, it.y, 'pin').setOrigin(0.5, 1); p.fixed = 2.2; this.fx.add(p); this.tweens.add({ targets: p, alpha: { from: 0, to: 1 }, duration: 250 }); return p; }
  label(it, ok = true) { const t = this.add.text(it.x, it.y, it.hz + '\n' + it.yale, { fontFamily: 'FP, FP2', fontSize: '12px', color: ok ? '#1f6b2a' : '#8a3a10', align: 'center', stroke: '#fbf3dd', strokeThickness: 4 }).setOrigin(0.5, 1); t.fixed = 1.4; t.dy = -12; this.fx.add(t); return t; }
  mark(x, y, ok) { const t = this.add.text(x, y, '×', { fontFamily: 'FP, FP2', fontSize: '24px', color: ok ? '#1f8a3a' : '#d0312d', stroke: '#fbf3dd', strokeThickness: 3 }).setOrigin(0.5); t.fixed = 1; this.fx.add(t); }
  line(x0, y0, x1, y1, ok) { const g = this.add.graphics(); g.lineStyle(1.5 / this.cam.zoom, ok ? 0x1f8a3a : 0xd0312d, 1); g.lineBetween(x0, y0, x1, y1); this.fx.add(g); }
  travel(from, to, kind, color) {
    return new Promise(res => {
      const key = kind === 'train' ? this.trainTex(color) : kind === 'bus' ? 'bus' : 'tour0';
      const spr = this.add.image(from.x, from.y, key); spr.fixed = 2; this.fx.add(spr);
      if (kind === 'walk') { spr.setOrigin(0.5, 1); spr.setFlipX(to.x > from.x); } else if (from !== to) { const a = Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)); spr.setAngle(a); if (Math.abs(a) > 90) spr.setFlipY(true); }
      if (kind === 'train' && from.t === 's' && to.t === 's') { const G = this.lineGeom(), k = from.k.slice(2) + '>' + to.k.slice(2), id = Object.keys(G.legs).find(i => LINES[i].color === color && G.legs[i][k]) || Object.keys(G.legs).find(i => G.legs[i][k]);
        if (id) { const path = G.legs[id][k], L = path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0), o = { f: 0 }; spr.setFlipY(false); this.follow = spr;
          this.tweens.add({ targets: o, f: 1, duration: Phaser.Math.Clamp(L * 18, 450, 1900), ease: 'Sine.easeInOut', onUpdate: () => { const p = this.ptAt(path, o.f), q = this.ptAt(path, Math.min(1, o.f + 0.02)); spr.setPosition(p.x, p.y); if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) this.aim(spr, Math.atan2(q.y - p.y, q.x - p.x)); }, onComplete: () => res(spr) }); return; } }
      this.follow = spr; const dist = Math.hypot(to.x - from.x, to.y - from.y); let n = 0;
      this.tweens.add({ targets: spr, x: to.x, y: to.y, duration: Phaser.Math.Clamp(dist * 18, 450, 1900), ease: 'Sine.easeInOut', onUpdate: () => { if (kind === 'walk') spr.setTexture(Math.floor(++n / 8) % 2 ? 'tour1' : 'tour0'); }, onComplete: () => res(spr) });
    });
  }
  update(t, dt) {
    const z = this.cam.zoom;
    if (Math.abs(z - this.lineZ) / Math.max(this.lineZ, 0.01) > 0.12 || this.lineZ < 0) this.drawLines();
    const want = z < 1 ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST; if (this.filter !== want) { this.textures.get('map').setFilter(want); this.filter = want; }
    if (this.staticImg && (this.staticT += dt) > 140) { this.staticT = 0; this.staticF = (this.staticF + 1) % this.staticKeys.length; this.staticImg.setTexture(this.staticKeys[this.staticF]); }
    if (this.staticLbl) this.staticLbl.setScale(Phaser.Math.Clamp(1.1 / z, 0.3, 1.5)).setVisible(z >= 0.6);
    const ms = Phaser.Math.Clamp(2.2 / z, 0.45, 2.6), geo = G.geoLabels, zk = z + '|' + geo + '|' + this.lb.length;
    if (zk !== this.lz) { this.lz = zk; /* rescale markers and labels only when the zoom (or what's shown) changes */
      this.mk.each(m => { if (m.visible) m.setScale(ms * (m.faint ? 0.6 : 1) * (m.it.t === 's' ? 0.78 : 1)); });
      this.lb.each(l => { l.setScale(Phaser.Math.Clamp(1.1 / z, 0.2, 1.5)); l.y = l.it.y - 5 * ms; });
      this.dl.each(c => { const v = geo && (c.isRegion ? z < 1.6 : z >= 1.6 && z < 3.4); c.setVisible(v); if (v) c.setScale(Phaser.Math.Clamp(1.15 / z, 0.2, 1.4)); }); }
    this.fx.each(f => { if (f.fixed) { f.setScale(Phaser.Math.Clamp(f.fixed / z, 0.1, 4)); } });
    this.lb.setVisible(z >= (this.labelMinZ || 0));
    this.geoG.setVisible(G.geoBorders !== false);
    if (this.follow && this.follow.active) { const ins = insets(), W = this.scale.width, H = this.scale.height, cx = (ins.left + W - ins.right) / 2, cy = (ins.top + H - ins.bottom) / 2; const tx = this.follow.x + (W / 2 - cx) / z, ty = this.follow.y - 8 / z + (H / 2 - cy) / z; this.cam.scrollX += (tx - W / 2 - this.cam.scrollX) * 0.12; this.cam.scrollY += (ty - H / 2 - this.cam.scrollY) * 0.12; }
    if (this.amb) try { this.tickAmb(dt, z); } catch (e) { console.error('ambient', e); this.amb.setVisible(false); this.amb = null; }
    if (G.tick) G.tick(dt);
  }
}

export { MAP, MapScene };
