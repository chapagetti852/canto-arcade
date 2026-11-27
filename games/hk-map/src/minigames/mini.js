import { $, ITEMS, LEVELS, esc, ic, pick, shuffle, touch } from "../core/util.js";
import { MUSIC, sfx } from "../audio/music.js";
import { KEYS, UI, bind, burst, setKEYS } from "../ui/dom.js";
import { say } from "../audio/voice.js";
import { base, checkYale, nfd, retone, toneInput } from "../yale/yale.js";
import { closeModal, openModal } from "../ui/modal.js";
import { G } from "../game/G.js";
import { save } from "../core/save.js";
import { ST, addPoints, levelStats, stars } from "../core/state.js";

// ===================================================================================================
// 小遊戲 mini-games: four short, slightly chaotic arcade games built on the names you have met.
// Each is a gate in the journey (levels 5, 9, 13, 17) and can be replayed from places on the map.
// Drawn on one small pixel canvas (360×540, scaled up), sounds from ZzFX, confetti on a win.
// ===================================================================================================
const MG_GATE = { 5: 'bus', 9: 'ferry', 13: 'bun', 17: 'typhoon' };
const MG_AT = { 'P:1792654808417': 'ferry', 'X:HARBOUR': 'ferry', 'S:MOK': 'bus', 'S:MKK': 'bus', 'P:1792654808966': 'bus', 'P:1792654807715': 'bun', 'X:LIONROCK': 'typhoon', 'P:1792654808317': 'typhoon' };
const MG = {
  bus: { zh: '有落！', yale: 'Yáuh lohk!', en: 'Minibus', how: 'You\'re on a red minibus and the driver won\'t stop unless you shout. Listen for your stop, then hit 有落！ just as its sign reaches the bus.', goal: 'Get off at 5 of 8 stops.' },
  ferry: { zh: '天星過海', yale: 'Tīnsīng gwo hói', en: 'Star Ferry', how: 'Steer the ferry (drag, or ← →) to catch the lifebuoy with the right Yale for the name at the top. Watch the tone marks — and the junks!', goal: 'Catch 7 of 10.' },
  bun: { zh: '搶包山', yale: 'Chéung bāausāan', en: 'Bun Scramble', how: 'Climb the Cheung Chau bun tower! Grab buns whose syllable has the tone shown at the top. Wrong tone and you slide down.', goal: 'Reach the top (12 buns) in 45 seconds.' },
  mahjong: { zh: '麻雀配對', yale: 'Màhjeuk puideui', en: 'Mahjong Match', how: 'Flip two mahjong tiles at a time to pair each name with its Yale. Every tile says its name when it turns over — listen!', goal: 'Clear all 8 pairs in 75 seconds.' },
  typhoon: { zh: '打風', yale: 'Dá fūng', en: 'Typhoon Signal', how: 'Names blow across the city in a rising typhoon. Type their Yale (tone numbers work: yau4 → yàuh) before they hit the ground.', goal: 'Blow away 10 names before your 3 umbrellas are gone.' },
};
const mgPassed = id => !!(ST.flags.mg && ST.flags.mg[id] && ST.flags.mg[id].pass);
function mgOpen(id) { if (id === 'mahjong') return mgPassed(id) || ITEMS.filter(i => stars(i) && i.t !== 'l').length >= 6;
  const g = Object.entries(MG_GATE).find(([, v]) => v === id); return mgPassed(id) || (ST.flags.mgo && ST.flags.mgo[id]) || (g && levelStats(LEVELS[g[0] - 2]).cleared); }
function mgOffer(id) { ST.flags.mgo = ST.flags.mgo || {}; if (!ST.flags.mgo[id]) { ST.flags.mgo[id] = 1; save(); } }

// tone of one Yale syllable (1–6), from its marks and the low-register h
function toneOf(s) {
  const n = s.normalize('NFD').toLowerCase(), b = n.replace(/[̀-ͯ]/g, ''), v = b.search(/[aeiou]/);
  const low = v >= 0 ? b.slice(v + 1).includes('h') : /h$/.test(b);
  if (n.includes('̄')) return 1; if (n.includes('́')) return low ? 5 : 2; if (n.includes('̀')) return low || v < 0 ? 4 : 1; return low ? 6 : 3;
}
const plainSyl = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/([aeiou])h(?=(ng|m|n|p|t|k)?$)/i, '$1').toLowerCase();
const TONE_LBL = { 1: 'ā  1', 2: 'á  2', 3: 'a  3', 4: 'àh  4', 5: 'áh  5', 6: 'ah  6' };
// a sound-alike: the same name with one syllable's tone changed
function toneTwin(it) {
  for (let tries = 0; tries < 8; tries++) {
    const i = Math.floor(Math.random() * it.syl.length), s = it.syl[i], t0 = toneOf(s), t = pick([1, 2, 3, 4, 5, 6].filter(x => x !== t0)), r = retone(plainSyl(s), t);
    if (!r) continue; const keepCap = s[0] === s[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
    const syl = it.syl.slice(); syl[i] = keepCap; let out = it.yale; out = out.replace(s, keepCap); if (out !== it.yale) return out;
  }
  return null;
}
// names to play with: the ones you've met, else the first levels'
function mgPool(min = 8) {
  let p = ITEMS.filter(i => stars(i) && i.t !== 'l');
  if (p.length < min) { const ks = new Set(LEVELS.slice(0, 4).flatMap(L => L.keys)); p = p.concat(ITEMS.filter(i => ks.has(i.k) && i.t !== 'l' && !p.includes(i))); }
  return shuffle(p.slice());
}

// ---------- tiny pixel engine ----------
function pix(rows, pal, k = 1) { const c = document.createElement('canvas'); c.width = rows[0].length * k; c.height = rows.length * k; const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x * k, y * k, k, k); } })); return c; }
const SPR = {};
function mgSprites() {
  if (SPR.bus) return;
  SPR.bus = pix(['....kkkkkkkkkkkkkkkkkkkkkk....', '...krrrrrrrrrrrrrrrrrrrrrrk...', '..krrrrrrrrrrrrrrrrrrrrrrrrk..', '..kccccccccccccccccccccccccck.', '..kcbbbbcbbbbcbbbbcbbbbcbbbck.', '..kcbbbbcbbbbcbbbbcbbbbcbbbck.', '.kccccccccccccccccccccccccccck', '.kcccc16cccccccccccccccccyyyck', '.kccccccccccccccccccccccccccck', '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkk', '...kggk..............kggk.....', '...kggk..............kggk.....', '....kk................kk......'],
    { k: '#20140c', r: '#c8382a', c: '#f1e4c2', b: '#7fb7d9', y: '#f6c945', g: '#3a3a3a', 1: '#c8382a', 6: '#c8382a' }, 2);
  SPR.ferry = pix(['..........kkkk..........', '.........kwwwwk.........', '...kkkkkkwwwwwwkkkkkk...', '..kwwbwwbwwbwwbwwbwwwk..', '..kwwwwwwwwwwwwwwwwwwk..', '.kggggggggggggggggggggk.', 'kggggggggwwggggggggggggk', '.kgggggggggggggggggggk..', '..kkkkkkkkkkkkkkkkkkk...'],
    { k: '#14201a', w: '#f4f1e6', b: '#3a6c9b', g: '#2f7d4f' }, 2);
  SPR.junk = pix(['.....k.......', '....krk...k..', '...kllk..krk.', '....krrk.krrk', '...kllllkllk.', '....krrk.kk..', 'kkkkkkkkkkkkk', '.kHHHHHHHHHk.', '..kkkkkkkkk..'], { k: '#2b1a10', r: '#c0472f', l: '#7a2e18', H: '#8a5a3a' }, 2);
  SPR.bun = pix(['...kkkk...', '.kkwwwwkk.', 'kwwwwrwwwk', 'kwwwwwwwwk', '.kkkkkkkk.'], { k: '#5a4632', w: '#f7efd9', r: '#d33a2c' }, 3);
  SPR.man = pix(['.kkk.', 'kffk.', '.kf..', 'krrrk', 'k.r.k', '.k.k.'], { k: '#20140c', f: '#f2c79b', r: '#c8382a' }, 3);
  SPR.brella = pix(['..kkk..', '.krrrk.', 'krrrrrk', '...k...', '...k...', '..kk...'], { k: '#20140c', r: '#d33a2c' }, 2);
}

let MGrun = null;
function runMini(id, opts = {}) {
  return new Promise(done => {
    mgSprites(); mgOffer(id);
    const def = MG[id], W = 360, H = 540;
    let ov = $('#mini'); if (!ov) { ov = document.createElement('div'); ov.id = 'mini'; UI.root.appendChild(ov); }
    ov.innerHTML = `<div class="mg-box panel"><div class="mg-top"><span class="mg-t"><b>${def.zh}</b> <span class="y">${def.yale}</span></span><span class="spacer"></span><span class="mg-stat"></span><button class="iconbtn" data-mg="x" title="Close (Esc)">${ic('close')}</button></div>
      <div class="mg-stage"><canvas width="${W}" height="${H}"></canvas><div class="mg-card"></div></div><div class="mg-bottom"></div></div>`;
    ov.hidden = false; document.body.classList.add('mg');
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d'), stage = ov.querySelector('.mg-stage'), card = ov.querySelector('.mg-card'), bottom = ov.querySelector('.mg-bottom'), stat = ov.querySelector('.mg-stat');
    g.imageSmoothingEnabled = false;
    const fit = () => { const r = stage.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H); cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px'; };
    const ro = new ResizeObserver(fit); ro.observe(stage); fit();
    const prevKeys = KEYS; setKEYS({}); MUSIC.play('mini');
    let raf = 0, last = 0, live = false, game = null, closed = false;
    const finish = res => { if (closed) return; closed = true; cancelAnimationFrame(raf); ro.disconnect(); ov.hidden = true; ov.innerHTML = ''; document.body.classList.remove('mg', 'kb'); setKEYS(prevKeys); MUSIC.play(opts.music || 'title'); done(res); };
    const FX = []; let flash = 0, flashC = '#fff';
    const T = { W, H, g, sfx, say, stat: h => stat.innerHTML = h, bottom: h => { bottom.innerHTML = h; }, bottomEl: bottom, end: r => end(r), shake: 0 };
    const text = (s, x, y, o = {}) => { g.font = o.sys ? `bold ${o.size || 14}px "Helvetica Neue", Arial, sans-serif` : `${o.size || 12}px FP, FP2, sans-serif`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; if (o.stroke) { g.lineWidth = 4; g.strokeStyle = o.stroke; g.strokeText(s, x, y); } g.fillStyle = o.color || '#f4ead2'; g.fillText(s, x, y); };
    T.text = text;
    /* juice: confetti-ish pixel bursts, floating text, a quick screen flash */
    T.pop = (x, y, cols = ['#f6c945', '#fff', '#5cc46a'], n = 16) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 140; FX.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.7 + Math.random() * 0.4, c: cols[i % cols.length], s: 2 + (Math.random() * 3 | 0) }); } };
    T.float = (t, x, y, c = '#f6c945') => FX.push({ x, y, vx: 0, vy: -40, life: 1, txt: t, c });
    T.flash = (c = '#d33a2c') => { flash = 0.18; flashC = c; };
    const fxStep = dt => { for (const p of FX) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.txt) p.vy += 260 * dt; } for (let i = FX.length - 1; i >= 0; i--) if (FX[i].life <= 0) FX.splice(i, 1); flash = Math.max(0, flash - dt); };
    const fxDraw = () => { for (const p of FX) { g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); if (p.txt) T.text(p.txt, p.x, p.y, { color: p.c, stroke: '#1d2340', size: 18, sys: true }); else { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } } g.globalAlpha = 1; if (flash > 0) { g.globalAlpha = flash * 2; g.fillStyle = flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; } };
    const intro = () => {
      live = false; bottom.innerHTML = ''; stat.innerHTML = '';
      card.innerHTML = `<div class="mg-c paper"><div class="mg-h">${def.zh}</div><div class="yl">${def.yale} · ${esc(def.en)}</div><p>${esc(def.how)}</p><p><b>${esc(def.goal)}</b></p>${opts.gate ? `<p class="y">Pass it to open level ${opts.gate}.</p>` : ''}<button class="btn primary" data-mg="go">${ic('play')} 開始 Hōichí</button></div>`;
      card.hidden = false; drawIdle();
    };
    const drawIdle = () => { g.fillStyle = '#1d2340'; g.fillRect(0, 0, W, H); for (let i = 0; i < 60; i++) { g.fillStyle = i % 3 ? '#2a3260' : '#3a6c9b'; g.fillRect((i * 97) % W, (i * 53) % H, 2, 2); } };
    const start = () => { FX.length = 0; T.over = false; card.hidden = true; game = GAMES[id](T, opts); live = true; last = performance.now(); raf = requestAnimationFrame(loop); };
    const end = r => {
      live = false; cancelAnimationFrame(raf); bottom.innerHTML = ''; document.body.classList.remove('kb');
      ST.flags.mg = ST.flags.mg || {}; const old = ST.flags.mg[id] || {}; ST.flags.mg[id] = { pass: old.pass || r.pass, best: Math.max(old.best || 0, r.score) }; addPoints(r.score * 4 + (r.pass ? 40 : 0)); save();
      T.over = true; if (r.pass) { sfx('sparkle'); MUSIC.jingle('level'); burst(0.5, 0.45, 120); } else sfx('buzz');
      card.innerHTML = `<div class="mg-c paper"><div class="mg-h">${r.pass ? '好嘢！' : '差少少！'}</div><div class="yl">${r.pass ? 'Hóu yéh! Great!' : 'Chā síusíu! So close!'}</div><p class="mg-score">${r.score} <small>${esc(r.unit || 'points')}</small></p>${r.note ? `<p>${r.note}</p>` : ''}
        <div class="row" style="gap:8px;justify-content:center;margin-top:10px"><button class="btn" data-mg="again">${ic('reload')} 再嚟 Joi làih</button><button class="btn ${r.pass ? 'primary' : ''}" data-mg="x">${ic('check')} ${r.pass && opts.gate ? 'Open level ' + opts.gate : 'OK'}</button></div></div>`;
      card.hidden = false; T.result = r;
    };
    const loop = t => { if (!live) return; const dt = Math.min(50, t - last); last = t; game.update(dt / 1000); fxStep(dt / 1000); g.save(); if (T.shake > 0) { T.shake -= dt; g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6); } game.draw(g); fxDraw(); g.restore(); raf = requestAnimationFrame(loop); };
    const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.addEventListener('pointerdown', e => { if (!live || !game.down) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); game.down(...toLogical(e)); });
    cv.addEventListener('pointermove', e => { if (live && game.move && (e.buttons || e.pointerType !== 'mouse')) game.move(...toLogical(e)); });
    cv.addEventListener('pointerup', () => { if (live && game.up) game.up(); });
    ov.addEventListener('click', e => { const b = e.target.closest('[data-mg]'); if (!b) return; const a = b.dataset.mg; sfx('blip'); if (a === 'go' || a === 'again') start(); else if (a === 'x') finish(T.result || { pass: false, score: 0 }); });
    MGrun = { key: e => { if (e.key === 'Escape') { finish(T.result || { pass: false, score: 0 }); return true; } if (!live) { if (e.key === 'Enter' || e.key === ' ') { start(); return true; } return false; } return game.key ? game.key(e) : false; } };
    intro();
    const o = finish; MGrun.close = () => o({ pass: false, score: 0 });
  }).finally(() => { MGrun = null; });
}

// ---------- the four games ----------
const sky = (g, W, H, top, bot) => { for (let y = 0; y < H; y += 6) { const f = y / H; g.fillStyle = `rgb(${top[0] + (bot[0] - top[0]) * f | 0},${top[1] + (bot[1] - top[1]) * f | 0},${top[2] + (bot[2] - top[2]) * f | 0})`; g.fillRect(0, y, W, 6); } };
const city = (g, W, base, seed, col, win, off = 0) => { let x = -((off % 40) + 40); let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; while (x < W + 40) { const w = 18 + rnd() * 26, h = 40 + rnd() * 120; g.fillStyle = col; g.fillRect(x, base - h, w, h); if (win) { g.fillStyle = win; for (let yy = base - h + 6; yy < base - 6; yy += 8) for (let xx = x + 4; xx < x + w - 4; xx += 6) if (rnd() > 0.55) g.fillRect(xx, yy, 2, 3); } x += w + 2; } };

const GAMES = {
  // 有落！ red minibus: shout at the right stop
  bus(T) {
    const { W, H, g } = T, pool = mgPool(), BUSX = 100, ROAD = 380;
    let round = 0, good = 0, speed = 70, signs = [], target = null, off = 0, msg = '', msgT = 0, bounce = 0, wait = 0, pax = [];
    const next = () => { if (T.over) return; if (round >= 8) return T.end({ pass: good >= 5, score: good, unit: 'of 8 stops', note: good >= 5 ? '司機：「好，落車！」 Sīgēi: "Hóu, lohkchē!"' : 'Listen for the name, then shout as its sign reaches the bus.' });
      round++; target = pool[(round - 1) % pool.length]; const others = shuffle(pool.filter(p => p !== target)).slice(0, 2 + Math.floor(Math.random() * 3));
      const seq = shuffle([target, ...others]); signs = seq.map((it, i) => ({ it, x: W + 40 + i * 150, done: false })); T.say(target); speed = 70 + round * 9; };
    const shout = () => { const s = signs.find(s => !s.done && Math.abs(s.x - BUSX) < 34); bounce = 1;
      if (!s) { T.sfx('buzz'); msg = '司機：「邊度呀？」 Where?'; msgT = 1.2; return; }
      s.done = true; if (s.it === target) { good++; T.sfx('coin'); T.pop(BUSX, ROAD - 60); T.float('+1 ' + target.hz, BUSX + 40, ROAD - 120); msg = '有落！ ✓ ' + target.hz; msgT = 1.2; pax.push({ x: BUSX, y: ROAD - 30, vy: -80 }); wait = 1.1; signs.forEach(z => z.done = true); }
      else { T.sfx('buzz'); T.shake = 300; T.flash(); msg = '唔係呢度！ Not here! (' + s.it.hz + ')'; msgT = 1.4; } };
    T.bottom(`<button class="btn primary mg-big" data-b="go">有落！ <small>Yáuh lohk!</small></button><button class="btn" data-b="say">${ic('volume-3')}</button>`);
    T.bottomEl.onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; if (b.dataset.b === 'go') shout(); else T.say(target); };
    next();
    return {
      key: e => { if (e.key === ' ' || e.key === 'Enter') { shout(); return true; } if (e.key === 'l' || e.key === 'L') { T.say(target); return true; } return false; },
      down: () => shout(),
      update: dt => { off += speed * dt * (wait > 0 ? 0.15 : 1); bounce = Math.max(0, bounce - dt * 3); msgT -= dt; if (wait > 0 && (wait -= dt) <= 0) next();
        if (wait <= 0) { signs.forEach(s => s.x -= speed * dt); if (signs.length && signs.every(s => s.x < -40)) { if (!signs.find(s => s.it === target).done) { msg = '過咗站！ Missed ' + target.hz; msgT = 1.4; T.sfx('buzz'); } next(); } }
        pax.forEach(p => { p.y += p.vy * dt; p.vy += 300 * dt; p.x -= speed * dt * 0.5; }); pax = pax.filter(p => p.y < H);
        T.stat(`站 ${round}/8 · ✓ ${good}`); },
      draw: g => { sky(g, W, H, [255, 196, 140], [120, 160, 210]); city(g, W, ROAD - 40, 7, '#5b6a92', '#f6e39a', off * 0.3); city(g, W, ROAD - 10, 3, '#384470', '#ffd970', off * 0.6);
        g.fillStyle = '#4a4a52'; g.fillRect(0, ROAD, W, H - ROAD); g.fillStyle = '#e8e0c8'; for (let x = -(off % 40); x < W; x += 40) g.fillRect(x, ROAD + 44, 20, 4); g.fillStyle = '#8b8b93'; g.fillRect(0, ROAD - 4, W, 4);
        signs.forEach(s => { if (s.x < -60 || s.x > W + 60) return; g.fillStyle = '#6b6b6b'; g.fillRect(s.x - 1, ROAD - 70, 3, 66); const big = s.it.hz.length <= 4, w = Math.max(48, s.it.hz.length * (big ? 25 : 13) + 12); g.fillStyle = s.done && s.it === target ? '#f6c945' : '#2f7d4f'; g.fillRect(s.x - w / 2, ROAD - 100, w, 30); g.strokeStyle = '#f4ead2'; g.lineWidth = 2; g.strokeRect(s.x - w / 2 + 2, ROAD - 98, w - 4, 26); T.text(s.it.hz, s.x, ROAD - 85, { color: '#fff', size: big ? 24 : 12 }); });
        g.drawImage(SPR.bus, BUSX - 60, ROAD - 50 - Math.round(Math.sin(off / 9) * 1.5) - bounce * 8, SPR.bus.width * 2, SPR.bus.height * 2); pax.forEach(p => g.drawImage(SPR.man, p.x, p.y));
        g.fillStyle = 'rgba(29,35,64,.85)'; g.fillRect(0, 0, W, 74); T.text(target ? target.yale : '', W / 2, 26, { size: 22, color: '#f6c945', sys: true }); T.text(target ? target.en : '', W / 2, 56, { color: '#c9c3b0' });
        if (msgT > 0) T.text(msg, W / 2, 130, { color: '#fff', stroke: '#1d2340' }); }
    };
  },
  // 天星過海 Star Ferry: catch the lifebuoy with the right Yale
  ferry(T) {
    const { W, H, g } = T, pool = mgPool();
    let x = W / 2, vx = 0, round = 0, good = 0, buoys = [], target = null, junks = [], stun = 0, msg = '', msgT = 0, t = 0, keys = {};
    const next = () => { if (T.over) return; if (round >= 10) return T.end({ pass: good >= 7, score: good, unit: 'of 10 caught', note: good >= 7 ? '一路順風！ Yātlouh seuhnfūng! Bon voyage!' : 'Look closely at the tone marks: àh, á, ah…' });
      round++; target = pool[(round - 1) % pool.length]; const twin = toneTwin(target), other = pick(pool.filter(p => p !== target)).yale;
      const opts = shuffle([target.yale, twin || pick(pool.filter(p => p !== target)).yale, other]); const sp = 38 + round * 4;
      buoys = opts.map((y, i) => ({ y: -30 - i * 70, x: 50 + Math.random() * (W - 100), label: y, ok: y === target.yale, vy: sp + Math.random() * 10, ph: Math.random() * 6 })); T.say(target); };
    const move = mx => { x = Math.max(30, Math.min(W - 30, mx)); };
    next();
    return {
      key: e => { if (e.key === 'ArrowLeft' || e.key === 'a') { keys.l = e.type !== 'keyup'; return true; } if (e.key === 'ArrowRight' || e.key === 'd') { keys.r = e.type !== 'keyup'; return true; } if (e.key === 'l' || e.key === 'L') { T.say(target); return true; } return false; },
      down: mx => move(mx), move: mx => move(mx),
      update: dt => { t += dt; msgT -= dt; if (stun > 0) stun -= dt; else { if (keys.l) x -= 200 * dt; if (keys.r) x += 200 * dt; x = Math.max(30, Math.min(W - 30, x)); }
        if (Math.random() < dt * (0.25 + round * 0.04)) junks.push({ x: Math.random() < 0.5 ? -30 : W + 30, y: 330 + Math.random() * 80, d: 0 }), junks[junks.length - 1].d = junks[junks.length - 1].x < 0 ? 1 : -1;
        junks.forEach(j => j.x += j.d * 60 * dt); junks = junks.filter(j => j.x > -40 && j.x < W + 40);
        junks.forEach(j => { if (stun <= 0 && Math.abs(j.x - x) < 34 && Math.abs(j.y - 470) < 20) { stun = 1; T.shake = 300; T.sfx('buzz'); msg = '撞船！ Bump!'; msgT = 1; } });
        buoys.forEach(b => { b.y += b.vy * dt; b.x += Math.sin(t * 2 + b.ph) * 18 * dt; if (!b.gone && b.y > 455 && b.y < 485 && Math.abs(b.x - x) < 38) { b.gone = true; if (b.ok) { good++; T.sfx('coin'); T.pop(b.x, b.y, ['#d33a2c', '#f4f1e6', '#f6c945']); T.float('✓', b.x, b.y - 30); msg = '✓ ' + target.yale; msgT = 1; buoys.forEach(z => z.gone = true); setTimeout(() => round && next(), 450); } else { T.sfx('buzz'); T.shake = 250; T.flash(); msg = '✗ ' + b.label; msgT = 1.2; } } });
        if (buoys.length && buoys.every(b => b.gone || b.y > H + 20) && !buoys.some(b => b.ok && b.gone)) { msg = 'Missed: ' + target.yale; msgT = 1.4; buoys = []; setTimeout(next, 600); }
        T.stat(`${round}/10 · ✓ ${good}`); },
      draw: g => { sky(g, W, 220, [20, 28, 60], [70, 70, 120]); city(g, W, 220, 11, '#262d52', '#f6e39a'); g.fillStyle = '#2b4f7a'; g.fillRect(0, 220, W, H - 220);
        g.fillStyle = '#4d77a6'; for (let i = 0; i < 40; i++) { const yy = 230 + (i * 37) % (H - 230), xx = ((i * 71) + t * 20 * (i % 2 ? 1 : -1)) % (W + 20); g.fillRect((xx + W) % W, yy, 6, 2); }
        junks.forEach(j => { g.save(); if (j.d < 0) { g.translate(j.x, 0); g.scale(-1, 1); g.translate(-j.x, 0); } g.drawImage(SPR.junk, j.x - 20, j.y - 27, SPR.junk.width * 1.5, SPR.junk.height * 1.5); g.restore(); });
        buoys.forEach(b => { if (b.gone) return; g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(b.x, b.y, 13, 0, 7); g.fill(); g.fillStyle = '#d33a2c'; for (let a = 0; a < 4; a++) { g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, 13, a * 1.57 + t, a * 1.57 + 0.6 + t); g.fill(); } g.fillStyle = '#2b4f7a'; g.beginPath(); g.arc(b.x, b.y, 6, 0, 7); g.fill();
          g.font = 'bold 15px "Helvetica Neue", Arial, sans-serif'; const w = g.measureText(b.label).width + 12; g.fillStyle = 'rgba(244,234,210,.96)'; g.fillRect(b.x - w / 2, b.y - 40, w, 22); T.text(b.label, b.x, b.y - 29, { color: '#1d2340', sys: true, size: 15 }); });
        g.drawImage(SPR.ferry, x - 48, 452 + Math.sin(t * 3) * 2, SPR.ferry.width * 2, SPR.ferry.height * 2); if (stun > 0) T.text('💫', x, 450);
        g.fillStyle = 'rgba(29,35,64,.85)'; g.fillRect(0, 0, W, 70); T.text(target ? target.hz : '', W / 2, 26, { size: 24 }); T.text(target ? target.en : '', W / 2, 54, { color: '#c9c3b0' });
        if (msgT > 0) T.text(msg, W / 2, 110, { color: '#fff', stroke: '#1d2340', sys: true }); }
    };
  },
  // 搶包山 Cheung Chau bun scramble: grab buns of the right tone
  bun(T) {
    const { W, H, g } = T; const syls = [...new Set(mgPool(10).flatMap(i => i.syl))].filter(s => /[a-z]/i.test(s));
    const byTone = {}; syls.forEach(s => (byTone[toneOf(s)] = byTone[toneOf(s)] || []).push(s));
    const tones = Object.keys(byTone).map(Number).filter(t => byTone[t].length >= 1);
    let h = 0, time = 45, target = 1, buns = [], msg = '', msgT = 0, t = 0, shuffleT = 0, slide = 0, climbY = 0;
    const deal = () => { target = pick(tones); const right = shuffle(byTone[target].slice()).slice(0, 2), wrong = shuffle(syls.filter(s => toneOf(s) !== target)).slice(0, 6 - right.length);
      const all = shuffle([...right, ...wrong]); buns = all.map((s, i) => ({ s, ok: toneOf(s) === target, x: 55 + (i % 3) * 92, y: 220 + Math.floor(i / 3) * 90, gone: false })); shuffleT = Math.max(1.8, 3.6 - h * 0.15); };
    deal();
    const grab = (mx, my) => { const b = buns.find(b => !b.gone && Math.abs(b.x - mx) < 40 && Math.abs(b.y - my) < 28); if (!b) return; b.gone = true;
      if (b.ok) { h++; T.sfx('coin', 1 + h * 0.04); T.pop(b.x, b.y, ['#f7efd9', '#d33a2c', '#f6c945']); msg = '✓ ' + b.s; msgT = 0.8; climbY = 1; if (h >= 12) return T.end({ pass: true, score: h + Math.ceil(time), unit: 'points', note: '包山王！ Bāausāan wòhng! King of the bun tower!' }); if (!buns.some(z => z.ok && !z.gone)) deal(); }
      else { h = Math.max(0, h - 1); T.sfx('buzz'); T.shake = 250; T.flash(); slide = 1; msg = `✗ ${b.s} is tone ${toneOf(b.s)}`; msgT = 1.3; } };
    return {
      down: grab,
      key: e => { const n = +e.key; if (n >= 1 && n <= 6) { const b = buns.filter(z => !z.gone)[n - 1]; if (b) grab(b.x, b.y); return true; } return false; },
      update: dt => { t += dt; time -= dt; msgT -= dt; slide = Math.max(0, slide - dt * 2); climbY = Math.max(0, climbY - dt * 3); if ((shuffleT -= dt) <= 0) { const live = buns.filter(b => !b.gone), pos = shuffle(live.map(b => [b.x, b.y])); live.forEach((b, i) => { b.x = pos[i][0]; b.y = pos[i][1]; }); shuffleT = Math.max(1.8, 3.6 - h * 0.15); T.sfx('blip', 0.6); }
        if (time <= 0) T.end({ pass: false, score: h, unit: 'buns climbed', note: 'Tones: ā 1 · á 2 · a 3 · àh 4 · áh 5 · ah 6' }); T.stat(`⏱ ${Math.ceil(time)} · ${h}/12`); },
      draw: g => { sky(g, W, H, [140, 200, 240], [250, 236, 200]);
        g.fillStyle = '#7a6a50'; g.beginPath(); g.moveTo(W - 90, H); g.lineTo(W - 50, 90); g.lineTo(W - 10, H); g.fill();
        for (let i = 0; i < 26; i++) { const yy = H - 20 - i * 17, ww = 74 - i * 2; for (let xx = -ww / 2; xx < ww / 2; xx += 12) g.drawImage(SPR.bun, W - 50 + xx - 15, yy - 7, 15, 8); }
        const cy = H - 30 - h * 34 + climbY * 10 + slide * 20; g.drawImage(SPR.man, W - 58, cy - 18); T.text('🏁', W - 50, 76);
        buns.forEach(b => { if (b.gone) return; const wob = Math.sin(t * 6 + b.x) * 2; g.drawImage(SPR.bun, b.x - 30, b.y - 15 + wob, 60, 30); T.text(b.s, b.x, b.y + 30 + wob, { size: 22, color: '#1d2340', stroke: '#f7efd9', sys: true }); });
        g.fillStyle = 'rgba(29,35,64,.88)'; g.fillRect(0, 0, W, 70); T.text('Grab tone', W / 2 - 60, 26, { color: '#c9c3b0' }); T.text(TONE_LBL[target], W / 2 + 40, 26, { size: 22, color: '#f6c945', sys: true }); T.text('搶包山 · Cheung Chau', W / 2, 56, { color: '#c9c3b0' });
        if (msgT > 0) T.text(msg, W / 2 - 40, 150, { color: '#1d2340', stroke: '#fff', sys: true }); }
    };
  },
  // 麻雀配對 mahjong match: pair each name tile with its Yale tile
  mahjong(T) {
    const { W, H, g } = T, items = mgPool(8).slice(0, 8), TW = 78, TH = 90, GX = (W - 4 * TW - 3 * 8) / 2, GY = 110;
    let time = 75, open = [], lock = 0, pairs = 0, moves = 0, t = 0, msg = '', msgT = 0, streak = 0;
    const tiles = shuffle(items.flatMap(it => [{ it, face: 'hz' }, { it, face: 'yale' }])).map((o, i) => Object.assign(o, { i, x: GX + (i % 4) * (TW + 8), y: GY + Math.floor(i / 4) * (TH + 8), flip: 0, up: false, gone: false, fly: 0 }));
    const at = (mx, my) => tiles.find(c => !c.gone && mx > c.x && mx < c.x + TW && my > c.y && my < c.y + TH);
    const tap = (mx, my) => { if (lock > 0) return; const c = at(mx, my); if (!c || c.up) return; c.up = true; open.push(c); T.sfx('blip', 1.2); if (c.face === 'hz') T.say(c.it);
      if (open.length === 2) { moves++; const [a, b] = open; if (a.it === b.it) { pairs++; streak++; T.sfx('coin', 1 + streak * 0.08); setTimeout(() => { [a, b].forEach(z => { z.gone = true; T.pop(z.x + TW / 2, z.y + TH / 2, ['#2f7d4f', '#f7efd9', '#d33a2c']); }); T.float(streak > 1 ? '連 ×' + streak : '✓', b.x + TW / 2, b.y); }, 250); msg = a.it.hz + ' · ' + a.it.yale; msgT = 1.6; open = [];
          if (pairs === 8) setTimeout(() => T.end({ pass: true, score: Math.ceil(time) + 40 - moves, unit: 'points', note: '食糊！ Sihkwùh! Mahjong!' }), 700); }
        else { streak = 0; lock = 0.9; T.sfx('buzz'); setTimeout(() => { a.up = b.up = false; open = []; }, 850); } } };
    const wrap = (txt, maxW, size) => { g.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; const words = txt.split(' '), lines = []; let cur = ''; for (const w of words) { const tr = cur ? cur + ' ' + w : w; if (g.measureText(tr).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tr; } lines.push(cur); return lines; };
    return {
      down: tap, key: () => false,
      update: dt => { t += dt; time -= dt; msgT -= dt; lock = Math.max(0, lock - dt); tiles.forEach(c => { c.flip += ((c.up ? 1 : 0) - c.flip) * Math.min(1, dt * 14); });
        if (time <= 0 && !T.over) T.end({ pass: false, score: pairs * 5, unit: 'points', note: pairs + ' of 8 pairs. Listen to each tile as it turns over.' }); T.stat(`⏱ ${Math.ceil(Math.max(0, time))} · ${pairs}/8`); },
      draw: g => { g.fillStyle = '#1f5a3c'; g.fillRect(0, 0, W, H); g.fillStyle = '#23663f'; for (let y = 0; y < H; y += 4) for (let x = (y / 4 % 2) * 2; x < W; x += 4) g.fillRect(x, y, 1, 1);
        tiles.forEach(c => { if (c.gone) return; const f = c.flip, sx = Math.abs(Math.cos(f * Math.PI)), face = f > 0.5, cx = c.x + TW / 2;
          g.save(); g.translate(cx, c.y); g.scale(Math.max(0.04, sx), 1);
          g.fillStyle = '#0e2a1c'; g.fillRect(-TW / 2 + 3, 4, TW, TH); /* shadow */
          g.fillStyle = face ? '#f7efd9' : '#2f8a5a'; g.fillRect(-TW / 2, 0, TW, TH); g.fillStyle = face ? '#e2d6b6' : '#24704a'; g.fillRect(-TW / 2, TH - 8, TW, 8); g.strokeStyle = '#14301f'; g.lineWidth = 2; g.strokeRect(-TW / 2 + 1, 1, TW - 2, TH - 2);
          if (!face) { g.fillStyle = '#5cc46a'; for (let k = 0; k < 3; k++) g.fillRect(-4 + (k - 1) * 14, 24, 6, 44); g.fillStyle = '#2f8a5a'; for (let k = 0; k < 3; k++) { g.fillRect(-4 + (k - 1) * 14, 38, 6, 2); g.fillRect(-4 + (k - 1) * 14, 54, 6, 2); } }
          else if (c.face === 'hz') { const L = c.it.hz.length, size = L <= 2 ? 30 : L <= 3 ? 22 : L <= 4 ? 17 : 12; const rows = L <= 4 ? [c.it.hz] : [c.it.hz.slice(0, Math.ceil(L / 2)), c.it.hz.slice(Math.ceil(L / 2))]; rows.forEach((r, k) => T.text(r, 0, TH / 2 - 4 + (k - (rows.length - 1) / 2) * (size + 4), { size, color: '#b0302a' })); }
          else { const lines = wrap(c.it.yale, TW - 10, 13); lines.forEach((l, k) => T.text(l, 0, TH / 2 - 4 + (k - (lines.length - 1) / 2) * 16, { size: 13, color: '#1d2340', sys: true })); }
          g.restore(); });
        g.fillStyle = 'rgba(14,42,28,.9)'; g.fillRect(0, 0, W, 64); T.text('麻雀配對', W / 2, 22, { size: 24 }); T.text('Match each name to its Yale', W / 2, 48, { color: '#c9c3b0' });
        if (msgT > 0) T.text(msg, W / 2, H - 20, { color: '#fff', stroke: '#0e2a1c', sys: true, size: 16 }); }
    };
  },
  // 打風 typhoon: type the Yale before the names hit the ground
  typhoon(T) {
    const { W, H, g } = T, pool = mgPool(); let words = [], spawn = 0.5, lives = 3, score = 0, sig = 1, t = 0, msg = '', msgT = 0, drops = [], gust = 0, n = 0;
    const SIG = [[1, 'T1', 22], [3, '▲3', 30], [8, '8', 40], [10, '✚10', 52]];
    T.bottom(`<div class="tb mg-tb"><div class="tb-row"><input class="tb-in" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Type the Yale…"><button class="btn sm gold" data-b="ok">${ic('check')}</button></div>
      ${ST.settings.tones ? `<div class="tb-tones">${[[1, 'ā'], [2, 'á'], [3, 'a'], [4, 'àh'], [5, 'áh'], [6, 'ah']].map(([k, l]) => `<button data-tone="${k}"><b>${l}</b>${k}</button>`).join('')}</div>` : ''}</div>`);
    const inp = T.bottomEl.querySelector('input'); if (!touch) setTimeout(() => inp.focus(), 50);
    const fire = () => { const v = inp.value.trim(); if (!v) return; const hit = words.find(w => !w.dead && checkYale(v, w.it).ok);
      if (hit) { hit.dead = 1; score++; T.sfx('coin', 1 + score * 0.03); T.pop(hit.x, hit.y, ['#f6c945', '#fff', '#9fd3ff'], 22); T.float('+1', hit.x, hit.y - 30); msg = '✓ ' + hit.it.yale; msgT = 1; inp.value = ''; if (score >= 10 && !T.won) { T.won = 1; } }
      else { const near = words.find(w => !w.dead && base(nfd(v)) === base(nfd(w.it.yale))); T.sfx('buzz'); msg = near ? 'Tones! ' + near.it.yale : '✗ ' + v; msgT = 1.2; } };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fire(); } });
    inp.addEventListener('input', () => { const m = inp.value.match(/([1-6])$/); if (m) { inp.value = inp.value.slice(0, -1); inp.setSelectionRange(inp.value.length, inp.value.length); toneInput(inp, +m[1]); } });
    T.bottomEl.onpointerdown = e => { const b = e.target.closest('[data-tone],[data-b]'); if (!b) return; e.preventDefault(); if (b.dataset.tone) toneInput(inp, +b.dataset.tone); else fire(); };
    return {
      key: () => false,
      update: dt => { t += dt; msgT -= dt; sig = score >= 9 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0; const sp = SIG[sig][2]; gust = Math.sin(t * 0.7) * (8 + sig * 10) + (Math.random() - 0.5) * sig * 6;
        if ((spawn -= dt) <= 0) { const it = pool[n++ % pool.length]; words.push({ it, x: 40 + Math.random() * (W - 80), y: 70, rot: 0 }); spawn = Math.max(1.6, 4.2 - sig * 0.8); }
        words.forEach(w => { if (w.dead) { w.y -= 160 * dt; w.x += 120 * dt; w.rot += dt * 6; return; } w.y += sp * dt; w.x = Math.max(30, Math.min(W - 30, w.x + gust * dt)); if (w.y > H - 40) { w.dead = 2; lives--; T.shake = 400; T.sfx('buzz'); msg = '☂ ' + w.it.hz + ' = ' + w.it.yale; msgT = 2; } });
        words = words.filter(w => !(w.dead && (w.y < -40 || w.dead === 2)));
        if (Math.random() < 0.9) drops.push({ x: Math.random() * W, y: 70, v: 300 + sig * 120 }); drops.forEach(d => { d.y += d.v * dt; d.x += gust * dt * 2; }); drops = drops.filter(d => d.y < H);
        if (lives <= 0) T.end({ pass: score >= 10, score, unit: 'names blown away', note: score >= 10 ? '十號風球都唔怕！ Even signal 10 can\'t stop you!' : 'Tip: type tone numbers after each syllable — yau4 → yàuh.' });
        else if (score >= 14) T.end({ pass: true, score, unit: 'names blown away', note: '天文台都要請你！ The Observatory should hire you!' });
        T.stat(`${'☂'.repeat(lives)} · ${score} · ${SIG[sig][1]}`); },
      draw: g => { sky(g, W, H, [40, 46, 70], [90, 100, 120]); city(g, W, H - 30, 5, '#2a2f48', '#c9b56a'); g.fillStyle = '#20243a'; g.fillRect(0, H - 30, W, 30);
        g.strokeStyle = 'rgba(200,210,230,.45)'; g.lineWidth = 1; g.beginPath(); drops.forEach(d => { g.moveTo(d.x, d.y); g.lineTo(d.x - gust * 0.05 - 2, d.y - 10); }); g.stroke();
        words.forEach(w => { g.save(); g.translate(w.x, w.y); g.rotate(w.rot); const big = w.it.hz.length <= 5, wd = Math.max(70, w.it.hz.length * (big ? 25 : 13) + 16); g.fillStyle = w.dead ? 'rgba(246,201,69,.9)' : 'rgba(244,234,210,.95)'; g.fillRect(-wd / 2, -22, wd, 44); T.text(w.it.hz, 0, -7, { color: '#1d2340', size: big ? 24 : 12 }); T.text(w.it.en.split(' (')[0].slice(0, 22), 0, 13, { size: 12, color: '#6b665b' }); g.restore(); });
        g.fillStyle = 'rgba(29,35,64,.85)'; g.fillRect(0, 0, W, 60); T.text('天文台 Observatory: signal', W / 2 - 40, 30, { color: '#c9c3b0' }); g.fillStyle = sig >= 2 ? '#d33a2c' : '#f6c945'; g.fillRect(W - 80, 12, 64, 36); T.text(SIG[sig][1], W - 48, 30, { size: 24, color: '#1d2340' });
        lives > 0 && [...Array(lives)].forEach((_, i) => g.drawImage(SPR.brella, 10 + i * 18, H - 26));
        if (msgT > 0) T.text(msg, W / 2, 100, { color: '#fff', stroke: '#1d2340', sys: true }); }
    };
  },
};

// list of mini-games (home → More)
function openMinis() {
  const rows = Object.entries(MG).map(([id, d]) => { const open = mgOpen(id), rec = (ST.flags.mg || {})[id], gate = (Object.entries(MG_GATE).find(([, v]) => v === id) || ['?'])[0];
    return `<button class="btn mgrow" data-id="${id}" ${open ? '' : 'disabled'}><span class="lbl"><b>${d.zh} <span class="y">${d.yale}</span></b><small>${esc(d.en)} · ${open ? (rec ? `best ${rec.best}${rec.pass ? ' ✓' : ''}` : 'new!') : gate === '?' ? 'meet 6 places to open' : 'opens before level ' + gate}</small></span></button>`; }).join('');
  openModal(`<div class="row"><h3 style="margin:0">${ic('gamepad')} 小遊戲 <span class="y">Síu yàuhhei</span> · Mini-games</h3><span class="spacer"></span><button class="iconbtn" data-a="x">${ic('close')}</button></div><p>Short, silly games with the names you have met. Each one also guards a stage of the journey.</p><div class="mglist">${rows}</div>`);
  $('#modal-box').querySelectorAll('[data-id]').forEach(b => b.onclick = () => { closeModal(false); runMini(b.dataset.id).then(() => G.home()); });
  bind($('#modal-box'), { x: () => closeModal() });
}

export { MG, MG_AT, MG_GATE, MGrun, mgPassed, openMinis, runMini };
