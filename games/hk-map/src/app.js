/* 香港通 Hēunggóng Tūng — a pixel field guide to Hong Kong.
   Map + game: Phaser 4 · music: Tone.js · sound effects: ZzFX · confetti: canvas-confetti · icons: pixelarticons.
   Everything you do is stored in this browser only (localStorage). No accounts, no server. */
(() => {
'use strict';
const DATA = window.HK_DATA, PH = window.HK_PHOTOS || {}, ICONS = window.HK_ICONS || {}, BUNDLED = new Set(window.HK_AUDIO || []);
const ITEMS = DATA.items, BY = {}; ITEMS.forEach(i => BY[i.k] = i);
const GEO = DATA.geo, LEVELS = DATA.levels, LINES = DATA.lines, CAT = DATA.cat || {};
const PX_M = 60.2;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<span class="ic ${cls}">${ICONS[n] || ''}</span>`;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isArea = it => !!it && (it.t === 'd' || it.t === 'r');
const TYPE = { s: '港鐵站 station', p: '景點 sight', c: '天主教堂 church', d: '地區 district', r: '大區 region', l: '港鐵綫 MTR line' };
const typeColor = it => it.t === 'l' ? LINES[it.k.slice(2)].color : ({ s: '#2a7ab0', p: '#b0782a', c: '#8e44ad', d: '#3c4680', r: '#1d2340' })[it.t];
const touch = matchMedia('(pointer:coarse)').matches;

// ---------- private Anki mode: only on Joseph's own browser (open the site once with ?anki) ----------
const params = new URLSearchParams(location.search);
if (params.has('anki')) { try { localStorage.setItem('hkmap-anki', params.get('anki') === 'off' ? '' : '1'); } catch (e) {} history.replaceState(null, '', location.pathname); }
const ANKI = (() => { try { return !!localStorage.getItem('hkmap-anki'); } catch (e) { return false; } })();

// ---------- state ----------
const LS = 'hkmapgame-v3';
const DEF_SET = { voice: 'zh-HK-HiuMaanNeural', region: '', key: '', sfx: true, music: true, tones: true };
const fresh = () => ({ v: 3, items: {}, updated: 0, points: {}, best: {}, missions: null, flags: {}, levels: {}, sent: {}, roamAt: null, settings: Object.assign({}, DEF_SET) });
let ST = fresh();
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const rec = k => ST.items[k] || (ST.items[k] = {});
function mastered(it, r) { r = r || ST.items[it.k]; if (!r) return false; if (r.m) return true; const days = (r.days || []).length >= 2; return it.t === 'l' ? (r.y || 0) >= 3 && days : (r.l || 0) >= 2 && (r.y || 0) >= 2 && days; }
function stars(it) { const r = ST.items[it.k]; if (!r || !r.s) return 0; if (mastered(it, r)) return 3; return ((r.l || 0) + (r.y || 0)) >= 2 ? 2 : 1; }
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function streak() { let n = 0; const d = new Date(); if (!ST.points[today()]) d.setDate(d.getDate() - 1); while (ST.points[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
function markCorrect(r) { const d = today(); r.days = Array.from(new Set([...(r.days || []), d])).slice(-8); r.lastDay = d; }
function credit(it, kind) { const r = rec(it.k), was = mastered(it, r); r[kind] = (r[kind] || 0) + 1; markCorrect(r); if (!was && mastered(it, r)) { r.m = today(); stampFx(it); } }
function debit(it, kind) { const r = rec(it.k); if (!r.m) r[kind] = Math.max(0, (r[kind] || 0) - 1); }
function meet(it) { const r = rec(it.k); if (r.s) return false; r.s = today(); return true; }
const RANKS = [[0, '遊客', 'Yàuhhaak', 'Tourist'], [60, '新手', 'Sānsáu', 'Beginner'], [200, '街坊', 'Gāaifōng', 'Local'], [450, '小巴司機', 'Síubā sīgēi', 'Minibus driver'], [800, '的士司機', 'Dīksí sīgēi', 'Taxi driver'], [1300, '港鐵達人', 'Góngtit daahtyàhn', 'MTR master'], [2200, '香港通', 'Hēunggóng tūng', 'Hong Kong expert']];
const xp = () => Object.values(ST.points).reduce((a, b) => a + b, 0);
const rankOf = x => { let r = 0; RANKS.forEach((R, i) => { if (x >= R[0]) r = i; }); return r; };
function addPoints(n) { if (!n) return; const before = rankOf(xp()); ST.points[today()] = (ST.points[today()] || 0) + n; const after = rankOf(xp()); if (after > before) setTimeout(() => { const R = RANKS[after]; MUSIC.jingle('level'); toast('升級！ ' + R[1], 'Sīngkāp! ' + R[2], 'Level up: ' + R[3], 3200); burst(0.5, 0.3, 80); }, 500); }
const MISSIONS = {
  ride: { goal: 1, en: 'Finish a tour or a ride' }, newn: { goal: 6, en: 'Meet 6 new names' }, find: { goal: 5, en: 'Find 5 spots on the map' },
  type: { goal: 8, en: 'Type 8 names from memory' }, combo: { goal: 5, en: 'Reach a 5× combo' }, rush: { goal: 1, en: 'Play a Rush Hour round' },
  star3: { goal: 3, en: 'Land 3 spot-on ★★★ finds' }, disc: { goal: 3, en: 'Discover 3 spots in free roam' },
  greet: { goal: 3, en: 'Say hi to 3 neighbours in free roam' }, snack: { goal: 1, en: 'Find a street snack in free roam' }, cat: { goal: 1, en: "Bring Pòhpó's cat home (free roam)" },
};
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function missionsToday() {
  const d = today();
  if (!ST.missions || ST.missions.date !== d) {
    const met = ITEMS.filter(i => stars(i)).length;
    const pool = Object.keys(MISSIONS).filter(k => met >= 6 || ['ride', 'newn', 'find', 'type', 'disc', 'greet', 'snack'].includes(k));
    let h = hashStr(d); const list = met < 12 ? ['ride', 'newn'] : [];
    while (list.length < 3) { const k = pool[h % pool.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; if (!list.includes(k)) list.push(k); }
    ST.missions = { date: d, list: list.map(id => ({ id, n: 0, done: false })) };
  }
  return ST.missions.list;
}
function mission(id, n = 1, asMax = false) {
  const m = missionsToday().find(x => x.id === id); if (!m || m.done) return;
  m.n = asMax ? Math.max(m.n, n) : m.n + n;
  if (m.n >= MISSIONS[id].goal) { m.n = MISSIONS[id].goal; m.done = true; addPoints(30); setTimeout(() => { MUSIC.jingle('mission'); toast('任務完成！ +30', 'Yahmmouh yùhnsìhng!', MISSIONS[id].en); }, 250); }
  save();
}
function levelStats(L) { const its = L.keys.map(k => BY[k]); const met = its.filter(i => stars(i)).length, two = its.filter(i => stars(i) >= 2).length, m = its.filter(i => mastered(i)).length; return { its, met, two, m, n: its.length, cleared: met === its.length && two >= Math.ceil(its.length * 0.7) }; }
function unlocked(n) { const g = MG_GATE[n]; return n <= 1 || !!ST.levels[n] || (levelStats(LEVELS[n - 2]).cleared && (!g || mgPassed(g))); }
const gatePending = n => !!MG_GATE[n] && n > 1 && levelStats(LEVELS[n - 2]).cleared && !mgPassed(MG_GATE[n]) && !ST.levels[n];
// the one thing to do next, for the big button on the home screen
function nextStep() {
  const L = currentLevel(), S = levelStats(L), need = Math.max(0, Math.ceil(S.n * 0.7) - S.two);
  if (S.met < S.n) return { L, zh: S.met ? '繼續 Gaijuhk' : '出發 Chēutfaat', yale: S.met ? 'continue' : 'start', sub: `meet ${S.n - S.met} new place${S.n - S.met > 1 ? 's' : ''}`, go: () => G.ride({ type: 'level', n: L.n }) };
  if (!S.cleared) return { L, zh: '練習 Lihnjaahp', yale: 'practise', sub: `★★ on ${need} more to clear the level`, go: () => G.practice({ type: 'level', n: L.n }) };
  const nx = LEVELS[L.n]; if (nx && gatePending(nx.n)) { const id = MG_GATE[nx.n]; return { L, zh: MG[id].zh, yale: MG[id].yale, sub: `mini-game: win it to open level ${nx.n}`, go: () => runMini(id, { gate: nx.n }).then(() => G.home()) }; }
  return { L, zh: '練習 Lihnjaahp', yale: 'practise', sub: 'every level cleared!', go: () => G.practice() };
}
function currentLevel() { for (const L of LEVELS) if (unlocked(L.n) && !levelStats(L).cleared) return L; return LEVELS[LEVELS.length - 1]; }
const ankiReady = () => ITEMS.filter(i => i.anki && mastered(i) && !ST.sent[i.k]);

// ---------- saving: this browser (+ the game folder, Anki mode on desktop Chrome) ----------
let saveTimer = null, DIR = null, dirOK = false;
function loadLocal() { try { const s = localStorage.getItem(LS); if (s) { const o = JSON.parse(s); ST = Object.assign(fresh(), o); ST.settings = Object.assign({}, DEF_SET, o.settings || {}); ST.sent = ST.sent || {}; ST.levels = ST.levels || {}; if (!ST.flags.tonesSet) ST.settings.tones = true; /* tone keys on for everyone unless switched off by hand */ } } catch (e) {} }
function save() { ST.updated = Date.now(); try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) {} clearTimeout(saveTimer); saveTimer = setTimeout(writeFolder, 1500); SYNC.soon(); }
/* ---- private sync between your own devices, through a secret GitHub gist (Anki mode only).
   The GitHub token lives in this browser's localStorage only — never in the progress, the exports or the code. */
const SYNC = (() => {
  const K = 'hkmap-sync', FILE = 'hkmap-progress.json', DESC = 'HK map game progress (private sync)';
  const cfg = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const setCfg = c => { try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) {} };
  let timer = null, busy = false, again = false, lastMsg = '';
  const api = async (path, opt = {}) => { const r = await fetch('https://api.github.com' + path, Object.assign({ cache: 'no-store' }, opt, { headers: { Authorization: 'Bearer ' + cfg().token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } })); if (!r.ok) throw new Error('GitHub ' + r.status); return r.json(); };
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.settings; return c; };
  // combine two saves: counts take the higher, day lists join, ticks stay ticked; anything else comes from the newer save
  const NEWER = new Set(['missions', 'roamAt']);
  const merge = (a, b, bNew, key) => {
    if (a === undefined || a === null) return b; if (b === undefined || b === null) return a; if (NEWER.has(key)) return bNew ? b : a;
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
    if (Array.isArray(a) && Array.isArray(b)) return a.concat(b).every(x => typeof x !== 'object') ? [...new Set([...a, ...b])] : (bNew ? b : a);
    if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = merge(a[k], b[k], bNew, k); return o; }
    return bNew ? b : a;
  };
  async function findGist() { const c = cfg(); if (c.gist) return c.gist; const list = await api('/gists?per_page=100'); const g = list.find(g => g.description === DESC && g.files[FILE]);
    if (g) { c.gist = g.id; setCfg(c); return g.id; }
    const made = await api('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(strip(ST)) } } }) }); c.gist = made.id; setCfg(c); return made.id; }
  async function run() {
    if (!ANKI || !cfg().token) return; if (busy) { again = true; return; } busy = true;
    try {
      const id = await findGist(), g = await api('/gists/' + id); let remote = null; try { remote = JSON.parse(g.files[FILE].content); } catch (e) {}
      const local = strip(ST), before = JSON.stringify(local);
      const merged = remote && remote.items ? merge(local, remote, (remote.updated || 0) > (local.updated || 0)) : local;
      merged.updated = Math.max(local.updated || 0, (remote && remote.updated) || 0);
      if (JSON.stringify(merged) !== before) { const keep = ST.settings; ST = Object.assign(fresh(), merged); ST.settings = keep; try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) {} if (typeof MAP !== 'undefined' && MAP && MAP.refresh) try { MAP.refresh(); } catch (e) {} }
      if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) await api('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(merged) } } }) });
      const c = cfg(); c.last = Date.now(); setCfg(c); lastMsg = 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { lastMsg = 'Sync failed: ' + e.message + (/401|403/.test(e.message) ? ' — check the token' : ''); }
    busy = false; if (again) { again = false; run(); }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); else if (timer) { clearTimeout(timer); timer = null; run(); } });
  addEventListener('online', () => run());
  return { on: () => ANKI && !!cfg().token, run, soon: () => { if (!ANKI || !cfg().token) return; clearTimeout(timer); timer = setTimeout(() => { timer = null; run(); }, 4000); },
    connect: t => { setCfg({ token: t.trim() }); return run(); }, off: () => { try { localStorage.removeItem(K); } catch (e) {} }, status: () => lastMsg || (cfg().last ? 'Last synced ' + new Date(cfg().last).toLocaleString() : '') };
})();
function publicState() { const o = JSON.parse(JSON.stringify(ST)); delete o.settings.key; return o; }
function importState(o) { if (!o || !o.items) throw new Error('Not a progress file'); const keep = ST.settings; ST = Object.assign(fresh(), o); ST.settings = Object.assign({}, DEF_SET, keep); ST.updated = Date.now(); save(); }
function idb() { return new Promise((res, rej) => { const q = indexedDB.open('hkmapgame', 2); q.onupgradeneeded = () => { const db = q.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio'); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function dbGet(store, k) { try { const db = await idb(); return await new Promise(r => { const t = db.transaction(store).objectStore(store).get(k); t.onsuccess = () => r(t.result); t.onerror = () => r(null); }); } catch (e) { return null; } }
async function dbSet(store, k, v) { try { const db = await idb(); await new Promise(r => { const t = db.transaction(store, 'readwrite').objectStore(store).put(v, k); t.onsuccess = r; t.onerror = r; }); } catch (e) {} }
async function writeFolder() { if (!ANKI || !DIR || !dirOK) return; try { const w = await (await DIR.getFileHandle('progress.json', { create: true })).createWritable(); await w.write(JSON.stringify(publicState(), null, 1)); await w.close(); } catch (e) { dirOK = false; } }
async function useFolder(h) {
  DIR = h; dirOK = true;
  try { const o = JSON.parse(await (await (await DIR.getFileHandle('progress.json')).getFile()).text()); if (o.v === 3 && (o.updated || 0) > (ST.updated || 0)) importState(o); } catch (e) {}
  writeFolder();
}
async function reconnectFolder(ask) { if (!ANKI || !window.showDirectoryPicker) return false; const h = DIR || await dbGet('kv', 'dir'); if (!h) return false; try { let p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'readwrite' }); if (p === 'granted') { await useFolder(h); return true; } } catch (e) {} DIR = h; return false; }

// ---------- music (Tone.js) & sound effects (ZzFX) ----------
const MUSIC = (() => {
  let ready = false, cur = null, part = null, playing = null, vol = null, inst = {}, ducks = 0; const BASE = -11;
  const CH = { E: ['E', 'G#', 'B'], C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Em: ['E', 'G', 'B'], Dm: ['D', 'F', 'A'], D: ['D', 'F#', 'A'], Bm: ['B', 'D', 'F#'] };
  const SONGS = { // original tunes written for this game (8th-note steps; '-' holds, '.' rests)
    title: { bpm: 132, bass: 'R.O.F.O.', drums: 'khshkksh', chords: ['C', 'Am', 'F', 'G', 'F', 'C', 'Dm', 'G'], lead: 'C5 . E5 G5 A5 - G5 E5 | D5 - E5 D5 C5 - A4 - | C5 . E5 G5 A5 - C6 A5 | G5 - - - . . E5 G5 | A5 - G5 A5 C6 - A5 G5 | E5 - D5 E5 G5 - E5 D5 | C5 . D5 E5 G5 E5 D5 A4 | C5 - - - . . . .',
      lead2: 'E5 . G5 C6 - - A5 G5 | A5 - G5 E5 D5 - - - | C5 . E5 G5 A5 - G5 E5 | D5 - - - . . . . | F5 - A5 C6 - A5 G5 F5 | E5 - G5 C6 - - G5 E5 | D5 . E5 G5 E5 D5 C5 A4 | C5 - - - . . . .' },
    ride: { bpm: 116, bass: 'RROROFRO', drums: 'khshkhsh', chords: ['G', 'Em', 'G', 'D', 'Em', 'C', 'D', 'G'], lead: 'G4 - B4 D5 - - B4 - | A4 - - G4 E4 - - - | G4 - B4 D5 - E5 D5 B4 | A4 - - - - - . . | B4 - D5 E5 - G5 E5 D5 | E5 - D5 B4 - A4 G4 - | A4 - B4 D5 - B4 A4 E4 | G4 - - - - - . .' },
    practice: { bpm: 100, bass: 'R...F...', drums: 'k.h.s.h.', chords: ['Am', 'Dm', 'C', 'Em', 'F', 'Am', 'G', 'Am'], lead: 'A4 - C5 - E5 - D5 C5 | D5 - - - . . . . | C5 - E5 - G5 - E5 D5 | E5 - - - . . . . | A5 - G5 E5 D5 - E5 G5 | E5 - D5 C5 A4 - - - | C5 D5 E5 - D5 C5 D5 - | A4 - - - . . . .' },
    roam: { bpm: 92, inst: 'pluck', arp: 'soft', bass: 'R...O...', drums: 'k...s..h', chords: ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G'],
      lead: 'E5 - G5 A5 G5 - E5 D5 | C5 - - D5 E5 - - - | A4 - C5 D5 E5 - G5 E5 | D5 - - - . . . . | E5 - G5 A5 C6 - A5 G5 | A5 - G5 E5 D5 - - - | C5 D5 E5 G5 E5 - D5 C5 | C5 - - - . . . .',
      lead2: 'G5 - A5 - C6 - A5 G5 | E5 - - - G5 - E5 D5 | C5 - D5 E5 - - D5 C5 | A4 - - - G4 - A4 - | C5 - - D5 E5 - G5 - | A5 - G5 - E5 - D5 - | E5 - G5 E5 D5 C5 A4 - | C5 - - - . . . .' },
    sea: { bpm: 84, inst: 'pluck', arp: 'soft', bass: 'R...O...', drums: 'k.......', chords: ['Am', 'G', 'F', 'G', 'Am', 'Em', 'F', 'G'],
      lead: 'A4 - - C5 D5 - E5 - | D5 - C5 - A4 - - - | G4 - A4 C5 - - D5 - | E5 - - - . . . . | A5 - G5 E5 - - D5 - | C5 - D5 E5 - - G4 - | A4 - C5 D5 E5 G5 E5 D5 | A4 - - - . . . .' },
    lamma: { bpm: 148, inst: 'pluck', bass: 'R.O.R.O.', drums: '.h.h.h.h', chords: ['Am', 'Am', 'Dm', 'Am', 'E', 'E', 'Am', 'Am'], /* Augustin's minor swing, for the tree house */
      lead: 'A4 C5 E5 A5 - G#5 A5 B5 | C6 - B5 A5 E5 - . . | D5 F5 A5 D6 - C6 A5 F5 | E5 - - - . . . . | B4 D5 E5 G#5 - B5 G#5 E5 | A5 - G#5 F5 E5 - D5 B4 | A4 C5 E5 A5 G#5 A5 C6 B5 | A5 - - - . . . .',
      lead2: 'E5 - A5 - C6 - B5 A5 | G#5 - A5 B5 C6 - - - | A5 - F5 - D5 - F5 A5 | G#5 - E5 - B4 - - - | E5 G#5 B5 E6 - D6 B5 G#5 | A5 - C6 - B5 - A5 G#5 | A5 E5 C5 A4 B4 C5 D5 E5 | A4 - - - . . . .' },
    mini: { bpm: 168, bass: 'RORORORO', drums: 'kkshkksh', chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
      lead: 'C5 E5 G5 E5 C6 - G5 - | B4 D5 G5 D5 B5 - G5 - | A4 C5 E5 C5 A5 - E5 - | F5 - A5 - C6 - A5 - | G5 - E5 G5 C6 - E5 - | D5 - G5 - B5 - D6 - | C6 - A5 F5 C5 - F5 A5 | G5 - - - B5 - D6 -' },
    rush: { bpm: 156, bass: 'RORORORO', drums: 'khshkksh', chords: ['Em', 'Bm', 'Em', 'G', 'C', 'D', 'Em', 'Em'], lead: 'E5 E5 G5 E5 A5 G5 E5 D5 | E5 - B4 - D5 - E5 - | E5 E5 G5 E5 A5 G5 B5 A5 | G5 - E5 - D5 - B4 - | C5 - E5 - G5 - E5 - | D5 - F#5 - A5 - F#5 - | E5 G5 B5 G5 A5 G5 E5 D5 | E5 - - - B4 - D5 -' },
  };
  const JINGLES = { softee: [['D5', 0, .2], ['F#5', .3, .2], ['A5', .6, .2], ['A5', .9, .4], ['A6', 1.5, .16], ['A6', 1.75, .16], ['F#6', 2.0, .16], ['F#6', 2.25, .3]], arrive: [['E5', 0, .16], ['C5', .2, .4]], doors: [['B5', 0, .06], ['B5', .12, .06], ['B5', .24, .06], ['B5', .36, .06], ['B5', .48, .06]], level: [['C5', 0, .1], ['E5', .1, .1], ['G5', .2, .1], ['C6', .3, .22], ['G5', .56, .1], ['C6', .68, .55]], mission: [['G5', 0, .09], ['B5', .1, .09], ['D6', .2, .09], ['G6', .31, .4]], win: [['C5', 0, .1], ['E5', .12, .1], ['G5', .24, .1], ['C6', .36, .1], ['E6', .48, .45]], stamp: [['G4', 0, .08], ['C5', .1, .3]] };
  function notes(str) { const ev = []; str.split(/\s+/).filter(t => t && t !== '|').forEach((t, i) => { const last = ev[ev.length - 1]; if (t === '-') { if (last && last.open) last.len++; } else if (t === '.') { if (last) last.open = false; } else ev.push({ i, n: t, len: 1, open: true }); }); return ev; }
  function build(S) {
    const T = 96, ev = [], leads = [S.lead, S.lead2].filter(Boolean), bars = S.chords.length * 8 * T, li = S.inst || 'lead';
    leads.forEach((L, k) => { for (const e of notes(L)) ev.push([k * bars + e.i * T, li, e.n, e.len * T - 12]); });
    /* the second time round, the arpeggio climbs an octave and the hats double: a little variety on long sessions */
    for (let k = 0; k < leads.length; k++) S.chords.forEach((c, b0) => { const ch = CH[c], b = b0 + k * S.chords.length;
      S.bass.split('').forEach((p, s) => { if (p !== '.') ev.push([(b * 8 + s) * T, 'bass', p === 'R' ? ch[0] + '2' : p === 'O' ? ch[0] + '3' : ch[2] + '2', T - 14]); });
      if (S.arp === 'soft') { for (let s = 0; s < 8; s++) if (s % 2 === 0) ev.push([b * 8 * T + s * T, 'arp', ch[[0, 2, 1, 2][s / 2]] + (k ? '5' : '4'), 80]); }
      else for (let s = 0; s < 16; s++) ev.push([b * 8 * T + s * 48, 'arp', ch[[0, 1, 2, 1][s % 4]] + (k ? '5' : '4'), 36]);
      S.drums.split('').forEach((p, s) => { const t = (b * 8 + s) * T; if (p === 'k') ev.push([t, 'kick', 'C1', 40]); if (p === 's') ev.push([t, 'snare', null, 40]); if (p === 'h' || (k && p === '.' && s % 2 && S.bpm > 110)) ev.push([t, 'hat', null, 20]); }); });
    return { ev, len: bars * leads.length };
  }
  function init() {
    if (ready || !window.Tone) return ready;
    try {
      vol = new Tone.Volume(BASE).toDestination();
      inst.lead = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.25 }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.45, release: 0.08 }, volume: -9 }).connect(vol);
      inst.bass = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.1, sustain: 0.7, release: 0.04 }, volume: -1 }).connect(vol);
      inst.arp = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.125 }, envelope: { attack: 0.002, decay: 0.06, sustain: 0.05, release: 0.03 }, volume: -23 }).connect(vol);
      inst.pluck = new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3600, resonance: 0.93, volume: 2 }).connect(vol); /* a guzheng-ish pluck for the wandering tunes */
      inst.kick = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 4, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }, volume: -9 }).connect(vol);
      const hp = new Tone.Filter(6500, 'highpass').connect(vol);
      inst.hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.01 }, volume: -20 }).connect(hp);
      inst.snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 }, volume: -17 }).connect(vol);
      inst.jingle = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.003, decay: 0.1, sustain: 0.4, release: 0.1 }, volume: -16 }).toDestination();
      ready = true;
    } catch (e) { ready = false; }
    return ready;
  }
  function stop() { if (!ready) return; try { playing = null; if (part) { part.dispose(); part = null; } Tone.Transport.stop(); Tone.Transport.cancel(); } catch (e) {} }
  function play(name) {
    if (name) cur = name;
    if (!ST.settings.music || !cur || !init() || Tone.context.state !== 'running') return;
    if (part && playing === cur && Tone.Transport.state === 'started') return;
    stop(); const S = SONGS[cur], b = build(S); Tone.Transport.bpm.value = S.bpm;
    part = new Tone.Part((time, e) => { try { const d = Tone.Ticks(e[3]).toSeconds(); if (e[1] === 'hat' || e[1] === 'snare') inst[e[1]].triggerAttackRelease(d, time); else inst[e[1]].triggerAttackRelease(e[2], d, time); } catch (err) {} }, b.ev.map(e => [e[0] + 'i', e]));
    playing = cur; part.loop = true; part.loopEnd = b.len + 'i'; part.start(0); Tone.Transport.position = 0; Tone.Transport.start('+0.05');
  }
  const tempo = bpm => { if (ready && part) Tone.Transport.bpm.rampTo(bpm, 1.5); };
  const duck = on => { if (!ready) return; ducks = Math.max(0, ducks + (on ? 1 : -1)); vol.volume.rampTo(ducks ? BASE - 14 : BASE, 0.15); };
  function jingle(name) { if (!ST.settings.sfx || !init() || Tone.context.state !== 'running') return; const t0 = Tone.now() + 0.03, J = JINGLES[name]; duck(true); J.forEach(([n, t, d]) => inst.jingle.triggerAttackRelease(n, d, t0 + t)); setTimeout(() => duck(false), (J[J.length - 1][1] + J[J.length - 1][2]) * 1000 + 150); }
  function unlock() {
    try { zzfxX.resume(); } catch (e) {}
    try { if (window.Tone) { const p = Tone.start(); if (p && p.then) p.then(() => play(), () => {}); } } catch (e) {}
    try { if (window.Tone && Tone.context.state === 'running') play(); } catch (e) {}
  }
  // keep trying on later taps until the audio is really running (iOS may refuse the first one)
  const retry = () => { try { if (window.Tone && Tone.context.state === 'running' && (!window.zzfxX || zzfxX.state === 'running')) { ['touchend', 'click', 'keydown'].forEach(t => document.removeEventListener(t, retry, true)); return; } } catch (e) {} unlock(); };
  ['touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, retry, true));
  return { play, stop, tempo, duck, jingle, unlock, toggle() { ST.settings.music = !ST.settings.music; save(); if (ST.settings.music) play(); else stop(); } };
})();
const SFX = { step: [.12, .05, 110, 0, .004, .03, 4, 1, , , , , , 2], splash: [.16, .1, 320, 0, .02, .12, 4, 1, -2, , , , , 3], meow: [.45, .05, 620, .03, .1, .22, 0, 1, 3, -.25, , , , , 14, , , .7], ding: [.45, 0, 1320, 0, .03, .45, 0, 1.6, , , , , .13], horn: [.5, 0, 98, .06, .45, .3, 2, 1, , , , , , .2, 3], whoosh: [.28, .2, 180, .12, .25, .45, 4, 1, 3, , , , , 6], cry: [.35, .05, 1900, .02, .06, .3, 0, 1, -9, , , , , , , , , .7], chime: [.45, 0, 988, 0, .05, .35, 0, 1, , , -247, .09], beep: [.35, 0, 520, 0, .04, .04, 2, 1, , , , , .09], neon: [.16, 0, 60, 0, .25, .05, 2, 1, , , , , , 1.5], clank: [.5, .1, 70, 0, .03, .2, 4, 2, , , , , , 2], blip: [.5, 0, 880, 0, .01, .05, 1], coin: [1, , 1675, , .06, .24, 1, 1.82, , , 837, .06], buzz: [.7, 0, 160, 0, .08, .22, 2, 1, -.6], stamp: [1.6, .1, 90, 0, .03, .25, 4, 2, , , , , , 1.2], sparkle: [.7, 0, 1400, .01, .04, .25, 0, 1, , , 700, .04, .06], pop: [.6, 0, 500, 0, .02, .08, 0, 1, 8], chirp: [.25, .05, 2300, 0, .02, .05, 0, 1, 25, , , , .05], clack: [.45, .1, 700, 0, 0, .03, 4, 1, , , , , .07], bump: [.5, 0, 140, 0, .03, .08, 0, 1, -4], whoosh: [.4, 0, 260, .08, .2, .35, 4, 1, 4] };
function sfx(name, mul) { if (!ST.settings.sfx || typeof zzfx !== 'function') return; try { const p = SFX[name].slice(); if (mul) p[2] *= mul; zzfx(...p); } catch (e) {} }

// ---------- names spoken: bundled recordings → saved Azure clips → your own Azure key → the device's Cantonese voice ----------
const fileOf = k => k.replace(':', '_') + '.mp3';
let VOICE = null;
function pickVoice() { try { const vs = speechSynthesis.getVoices(); VOICE = vs.find(v => /zh[-_]HK/i.test(v.lang)) || vs.find(v => /yue/i.test(v.lang)) || null; } catch (e) {} }
function playUrl(u) { return new Promise((res, rej) => { const a = new Audio(u); a.onended = res; a.onerror = rej; a.play().catch(rej); }); }
function speak(text) { return new Promise(res => { if (!window.speechSynthesis) return res(); try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-HK'; if (VOICE) u.voice = VOICE; u.rate = 0.85; u.onend = res; u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 4000); } catch (e) { res(); } }); }
async function azure(text, voice) {
  const s = ST.settings; if (!s.key || !s.region) throw new Error('no key');
  const ssml = `<speak version="1.0" xml:lang="zh-HK"><voice name="${voice || s.voice}">${text.replace(/[<&>]/g, '')}</voice></speak>`;
  const r = await fetch(`https://${s.region.trim()}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': s.key.trim(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml });
  if (!r.ok) throw new Error('Azure ' + r.status); return await r.blob();
}
async function saveToFolder(f, b) { if (!ANKI || !DIR || !dirOK) return; try { const ad = await DIR.getDirectoryHandle('audio', { create: true }); const w = await (await ad.getFileHandle(f, { create: true })).createWritable(); await w.write(b); await w.close(); } catch (e) {} }
async function audioFor(it, make) {
  const f = fileOf(it.k);
  if (BUNDLED.has(f)) return 'audio/' + encodeURIComponent(f);
  const c = await dbGet('audio', f); if (c) return URL.createObjectURL(c);
  if (make && ST.settings.key && ST.settings.region) { const b = await azure(it.hz); await dbSet('audio', f, b); saveToFolder(f, b); return URL.createObjectURL(b); }
  return null;
}
let sayGen = 0;
/* spoken lines (neighbours, Pòhpó, snack names): a bundled Azure clip if the game ships one, else one made with your own key (kept in this browser), else the device voice */
const VOICES = ['zh-HK-HiuMaanNeural', 'zh-HK-WanLungNeural', 'zh-HK-HiuGaaiNeural'];
const lineFile = (hz, v) => 'ph_' + hashStr(v + '|' + hz).toString(36) + '.mp3';
async function lineUrl(hz, v, make) { const f = lineFile(hz, v); if (BUNDLED.has(f)) return 'audio/' + f; const c = await dbGet('audio', f); if (c) return URL.createObjectURL(c);
  if (make && ST.settings.key && ST.settings.region) { const b = await azure(hz, v); await dbSet('audio', f, b); saveToFolder(f, b); return URL.createObjectURL(b); } return null; }
async function sayLine(hz, v = VOICES[0]) { const g = ++sayGen; MUSIC.duck(true);
  try { const u = await lineUrl(hz, v, true).catch(() => null); if (g !== sayGen) return; if (u) { try { await playUrl(u); return; } catch (e) {} } await speak(hz); } finally { MUSIC.duck(false); } }
async function say(it) {
  if (!it) return; const g = ++sayGen; MUSIC.duck(true);
  try { const u = await audioFor(it, true).catch(() => null); if (g !== sayGen) return; if (u) { try { await playUrl(u); return; } catch (e) {} } await speak(it.hz); }
  finally { MUSIC.duck(false); }
}

// ---------- photos: Wikimedia Commons ----------
const photoUrl = it => PH[it.k] ? PH[it.k].u : null;
const GAL = window.HK_GAL || {};
const photosOf = it => [PH[it.k], ...(GAL[it.k] || []).map(([u, by, lic]) => ({ u, by, lic }))].filter(Boolean);
const creditOf = p => p ? '📷 ' + esc(p.by) + ' · ' + esc(p.lic) + ' · Wikimedia Commons' : '';
// photo galleries and mini-game buttons inside any fact card (delegated, so every card gets them)
document.addEventListener('click', e => {
  const th = e.target.closest('.gal img'); if (th) { const card = th.closest('[data-k]'), it = BY[card.dataset.k], ps = photosOf(it), i = +th.dataset.i, main = card.querySelector('img.ph'); if (main) main.src = ps[i].u; const cr = card.querySelector('.pcr'); if (cr) cr.innerHTML = creditOf(ps[i]); card.querySelectorAll('.gal img').forEach(x => x.classList.toggle('on', x === th)); sfx('blip'); return; }
  const fth = e.target.closest('img.fth'); if (fth) { const card = fth.closest('[data-k]'), it = BY[card.dataset.k], ps = photosOf(it); let i = +(fth.dataset.i || 0);
    if (!fth.classList.contains('open')) fth.classList.add('open'); else { openLightbox(it, i); e.stopPropagation(); return; }
    fth.dataset.i = i; const cr = card.querySelector('.pcr'); if (cr) cr.innerHTML = creditOf(ps[i]); e.stopPropagation(); return; }
  const mg = e.target.closest('[data-playmg]'); if (mg) { const id = mg.dataset.playmg; if (modalOpen()) closeModal(false); hideFact(); runMini(id).then(() => { if (G.mode === 'roam') return; G.home(); }); }
}, true);
// big photos: a lightbox with arrows / swipe, the 1280 px Commons version when there is one
const commonsPage = u => { const m = /\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//.exec(u || ''); return m ? 'https://commons.wikimedia.org/wiki/File:' + m[1] : null; };
function openLightbox(it, i = 0) {
  const ps = photosOf(it); if (!ps.length) return; let k = Math.max(0, Math.min(i, ps.length - 1)), x0 = null;
  const ov = document.createElement('div'); ov.className = 'lbx'; document.body.appendChild(ov);
  const draw = () => { const p = ps[k], src = commonsPage(p.u); ov.innerHTML = `<img class="lim" alt="" src="${esc(p.u.replace('/500px-', '/1280px-'))}" data-small="${esc(p.u)}"><div class="lcap"><b>${esc(it.hz)}</b> <span class="y">${esc(it.yale)}</span> · ${esc(it.en)}<br><small>${creditOf(p)}${src ? ` · <a href="${esc(src)}" target="_blank" rel="noopener">source</a>` : ''}${ps.length > 1 ? ' · ' + (k + 1) + ' / ' + ps.length : ''}</small></div>${ps.length > 1 ? '<button class="lb lp" aria-label="previous">‹</button><button class="lb ln" aria-label="next">›</button>' : ''}<button class="lb lx" aria-label="close">✕</button>`;
    const im = ov.querySelector('.lim'); im.onerror = () => { if (im.src !== im.dataset.small) im.src = im.dataset.small; }; };
  const go = d => { k = (k + d + ps.length) % ps.length; draw(); sfx('blip'); };
  const close = () => { ov.remove(); removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else return; e.stopPropagation(); e.preventDefault(); };
  ov.addEventListener('click', e => { if (e.target.closest('.lp')) go(-1); else if (e.target.closest('.ln')) go(1); else if (e.target.closest('a')) return; else if (e.target.closest('.lx') || !e.target.closest('.lim, .lcap')) close(); });
  ov.addEventListener('pointerdown', e => { x0 = e.clientX; }); ov.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 50 && ps.length > 1) go(e.clientX < x0 ? 1 : -1); x0 = null; });
  addEventListener('keydown', key, true); draw();
}
// a deeper dive: the opening of the English and the Cantonese Wikipedia articles
async function wikiFor(it, el) {
  el.innerHTML = '<div class="tx">…</div>'; el.hidden = false;
  const url = (lang, term) => `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(term)}&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exchars=900`;
  const get = async (lang, term) => { try { const j = await (await fetch(url(lang, term))).json(); const p = j.query && Object.values(j.query.pages)[0]; return p && p.extract ? p : null; } catch (e) { return null; } };
  const term = it.t === 's' ? it.en + ' station MTR' : /hong kong/i.test(it.en) ? it.en : it.en + ' Hong Kong';
  const [en, yue] = await Promise.all([get('en', term), get('zh-yue', it.hz)]);
  if (yue) yue.extract = yue.extract.replace(/粵拼[：:][^；;）)]*[；;]?\s*/g, '').replace(/[（(]\s*[）)]/g, ''); /* this game shows Yale only, so drop the article's Jyutping */
  const sec = (p, title) => p ? `<div class="wk"><div class="wkh">${title} · <a href="${esc(p.fullurl)}" target="_blank" rel="noopener">${esc(p.title)} ↗</a></div><div class="tx">${esc(p.extract).replace(/\n+/g, '<br>')}</div></div>` : '';
  el.innerHTML = (sec(yue, '粵文維基 <span class="y">Yuhtmàhn Wàihgēi</span>') + sec(en, 'Wikipedia')) || '<div class="tx">No article found.</div>';
}
document.addEventListener('click', e => {
  const ph = e.target.closest('[data-k] img.ph'); if (ph) { const card = ph.closest('[data-k]'), it = BY[card.dataset.k], ps = photosOf(it), i = Math.max(0, ps.findIndex(p => p.u === ph.getAttribute('src'))); openLightbox(it, i); e.stopPropagation(); return; }
  const wb = e.target.closest('[data-wiki]'); if (wb) { const card = wb.closest('[data-k]'), it = BY[card.dataset.k], el = card.querySelector('.wiki'); if (el && el.hidden) { wikiFor(it, el); sfx('blip'); } else if (el) el.hidden = true; e.stopPropagation(); return; }
}, true);
const credit_ = it => PH[it.k] ? '📷 ' + esc(PH[it.k].by) + ' · ' + esc(PH[it.k].lic) + ' · Wikimedia Commons' : '';

// ---------- Yale: checking answers, and typing tones with numbers (yau4 → yàuh) ----------
const nfd = s => s.normalize('NFD').toLowerCase().replace(/[^a-z̀-ͯ]/g, '');
const base = s => s.replace(/[̀-ͯ]/g, '');
function checkYale(typed, it) {
  const u = nfd(typed), t = nfd(it.yale);
  if (!u) return { ok: false, empty: true };
  if (u === t) return { ok: true };
  if (base(u) === base(t)) {
    const parts = []; let i = 0; const ua = [...u];
    for (const syl of it.syl) { const sn = nfd(syl), need = base(sn).length; let got = '', letters = 0;
      while (i < ua.length && (letters < need || /[̀-ͯ]/.test(ua[i]))) { if (!/[̀-ͯ]/.test(ua[i])) { if (letters === need) break; letters++; } got += ua[i]; i++; }
      parts.push({ syl, right: got === sn }); }
    return { ok: false, tones: true, parts };
  }
  return { ok: false };
}
const INITS = ['ng', 'gw', 'kw', 'ch', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'w', 'j', 's', 'y'];
function retone(word, t) {
  const ch = []; for (const c of word.normalize('NFD')) { if (/[\u0300-\u036f]/.test(c)) { if (ch.length) ch[ch.length - 1].m += c; } else ch.push({ c, m: '' }); }
  const low = ch.map(x => x.c.toLowerCase()).join(''); let i = low.length;
  const mark = { 1: '\u0304', 2: '\u0301', 4: '\u0300', 5: '\u0301' }[t] || '';
  if (low.endsWith('ng') && /[aeiouh]/.test(low[i - 3] || '')) i -= 2; else if (/[mnptk]/.test(low[i - 1] || '') && /[aeiouh]/.test(low[i - 2] || '')) i -= 1;
  const codaStart = i; if (low[i - 1] === 'h' && /[aeiou]/.test(low[i - 2] || '')) i -= 1;
  const hPos = i; while (i > 0 && /[aeiou]/.test(low[i - 1])) i--;
  const vStart = i;
  if (vStart === hPos) { // syllabic m / ng (唔 m̀, 五 ńgh)
    const m = low.match(/(ng|m)h?$/); if (!m) return null;
    const b = m[1], len = m[0].length, head = ch.slice(0, ch.length - len).map(x => x.c + x.m).join(''), first = ch[ch.length - len].c;
    return (head + first + mark + b.slice(1) + (t >= 4 && !(b === 'm' && t === 4) ? 'h' : '')).normalize('NFC');
  }
  let j = vStart; while (j > 0 && !/[aeiou]/.test(low[j - 1])) j--;
  const run = low.slice(j, vStart); let ini = ''; for (const I of INITS) if (run.endsWith(I) && I.length > ini.length) ini = I;
  const sStart = vStart - ini.length;
  const head = ch.slice(0, sStart).map(x => x.c + x.m).join(''), iniS = ch.slice(sStart, vStart).map(x => x.c).join(''), vowS = ch.slice(vStart, hPos).map(x => x.c), codaS = ch.slice(codaStart).map(x => x.c).join('');
  return (head + iniS + vowS[0] + mark + vowS.slice(1).join('') + (t >= 4 ? 'h' : '') + codaS).normalize('NFC');
}
function toneInput(inp, t) {
  const pos = inp.selectionStart == null ? inp.value.length : inp.selectionStart, before = inp.value.slice(0, pos), after = inp.value.slice(pos);
  const m = before.normalize('NFD').match(/[A-Za-z̀-ͯ]+$/); if (!m) return false;
  const res = retone(m[0], t); if (!res) return false;
  const head = before.normalize('NFD').slice(0, before.normalize('NFD').length - m[0].length).normalize('NFC');
  inp.value = head + res + after; const p = (head + res).length; inp.setSelectionRange(p, p); return true;
}

// ---------- DOM UI ----------
const UI = { root: $('#ui'), hud: $('#hud'), sheet: $('#sheet'), side: $('#side'), center: $('#center'), pad: $('#pad'), zoom: $('#zoom'), bao: $('#bao'), toasts: $('#toasts') };
let KEYS = {}; // keyboard shortcuts for the current screen
function show(el, html) { if (html == null || html === false) { el.hidden = true; el.innerHTML = ''; } else { el.innerHTML = html; el.hidden = false; } }
const setHud = h => show(UI.hud, h), setSheet = h => { show(UI.sheet, h); placeBao(); }, setCenter = h => show(UI.center, h), setSide = (h, cls = 'paper') => { show(UI.side, h); UI.side.className = cls + ' slide'; };
function clearUI() { [UI.hud, UI.sheet, UI.side, UI.center, UI.pad, UI.zoom].forEach(e => show(e, null)); UI.sheet.className = 'panel'; hideBao(); KEYS = {}; ['#visit', '#travel'].forEach(q => { const v = $(q); if (v) v.remove(); }); }
function bind(root, map) { root.querySelectorAll('[data-a]').forEach(b => { const f = map[b.dataset.a]; if (f) b.onclick = e => { e.stopPropagation(); sfx('blip'); f(b, e); }; }); }
// rectangles measured inside #ui (which follows the visible screen when the keyboard is up)
function rel(el) { const u = UI.root.getBoundingClientRect(), b = el.getBoundingClientRect(); return { left: b.left - u.left, right: b.right - u.left, top: b.top - u.top, bottom: b.bottom - u.top, width: b.width, height: b.height }; }
function insets() {
  const vw = UI.root.clientWidth, vh = UI.root.clientHeight, r = { top: 0, bottom: 0, left: 0, right: 0 };
  if (!UI.hud.hidden) r.top = rel(UI.hud).bottom;
  if (!UI.sheet.hidden) { const b = rel(UI.sheet); if (b.left > vw * 0.3 && b.width < vw * 0.7) r.right = vw - b.left + 6; else r.bottom = vh - b.top; }
  if (!UI.side.hidden && getComputedStyle(UI.side).display !== 'none') { const b = rel(UI.side); if (vw - b.left < vw * 0.45) r.right = vw - b.left + 8; }
  if (!UI.center.hidden) { const c = UI.center.firstElementChild; if (c && c.classList.contains('dock')) { const b = rel(c); r.left = b.right; } else if (c && c.classList.contains('home')) { const b = rel(c); if (b.top > vh * 0.2) r.bottom = vh - b.top; } }
  return r;
}
function toast(a, b, c, ms = 2600) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<b>${esc(a)}</b>${b ? `<i>${esc(b)}</i>` : ''}${c ? `<s>${esc(c)}</s>` : ''}`; UI.toasts.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 320); }, ms); }
function banner(html, cls = 'paper') { const b = document.createElement('div'); b.className = 'banner ' + cls; b.innerHTML = html; UI.root.appendChild(b); setTimeout(() => b.remove(), 2700); }
function burst(x = 0.5, y = 0.4, n = 60) { try { if (window.confetti) confetti({ particleCount: n, spread: 70, startVelocity: 38, origin: { x, y }, colors: ['#f6c945', '#e8463c', '#5cc46a', '#5eb6e4', '#f550a6', '#fff6dc'], shapes: ['square'], scalar: 0.9, disableForReducedMotion: true }); } catch (e) {} }
function stampFx(it) { sfx('stamp'); MUSIC.jingle('stamp'); const s = document.createElement('div'); s.className = 'stamp'; s.textContent = '識'; document.body.appendChild(s); setTimeout(() => s.remove(), 1400); toast('★★★ ' + it.hz + ' 識！', it.yale + ' · Sīk!', 'Mastered — stamped in your 圖鑑.' + (ANKI && it.anki ? ' Ready for Anki.' : ''), 3200); burst(0.5, 0.38, 50); }

// ---------- mascot 包仔 Bāaujái ----------
const BAO = {
  pal: { a: '#5a3214', b: '#fff1d6', r: '#d8432a', e: '#2b1a10', p: '#ff9aa8', m: '#7a2a18' },
  top: ['......aaaa......', '....aabbbbaa....', '...abbbrrbbba...', '..abbbrrrrbbba..', '.abbbbbrrbbbbba.', '.abbbbbbbbbbbba.', 'abbbbbbbbbbbbbba'],
  bottom: ['.abbbbbbbbbbbba.', '..aabbbbbbbbaa..', '....aaaaaaaa....', '................'],
  face: { ok: ['abbbeebbbbeebbba', 'abbbeebbbbeebbba', 'abpbbbbbbbbbbpba', 'abbbbbbmmbbbbbba', 'abbbbbbbbbbbbbba'], happy: ['abbbbebbbbebbbba', 'abbbebebbebebbba', 'abpbbbbbbbbbbpba', 'abbbbbmbbmbbbbba', 'abbbbbbmmbbbbbba'], sad: ['abbbebebbebebbba', 'abbbbebbbbebbbba', 'abpbbbbbbbbbbpba', 'abbbbbbmmbbbbbba', 'abbbbbmbbmbbbbba'] },
  url: {},
};
for (const [mood, face] of Object.entries(BAO.face)) { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); [...BAO.top, ...face, ...BAO.bottom].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = BAO.pal[ch]; g.fillRect(x, y, 1, 1); } })); BAO.url[mood] = c.toDataURL(); }
const SAY = {
  hi: [['你好！', 'Néih hóu!', 'Hello!'], ['歡迎返嚟！', 'Fūnyìhng fāanlàih!', 'Welcome back!']],
  good: [['好嘢！', 'Hóu yéh!', 'Yay!'], ['犀利！', 'Sāileih!', 'Awesome!'], ['叻仔！', 'Lēkjái!', 'Clever!'], ['正呀！', 'Jeng a!', 'Great!'], ['冇問題！', 'Móuh mahntàih!', 'No problem!']],
  bad: [['唔緊要', 'M̀gányiu', 'Never mind'], ['差少少', 'Chā síusíu', 'Almost!'], ['再嚟過', 'Joi làih gwo', 'Try again'], ['慢慢嚟', 'Maahnmáan làih', 'Take it easy'], ['加油！', 'Gāyàuh!', 'Keep going!']],
  tone: [['留意聲調！', 'Làuhyi sīngdiuh!', 'Watch the tones!']],
  go: [['一齊去搭港鐵啦！', 'Yātchàih heui daap Góngtit lā!', "Let's ride the MTR!"]],
  fast: [['快啲！快啲！', 'Faai dī! Faai dī!', 'Hurry! Hurry!']],
};
let baoTimer = null;
function placeBao() { const vw = UI.root.clientWidth, rb = rel(UI.sheet), docked = !UI.sheet.hidden && rb.left > vw * 0.3 && rb.width < vw * 0.7; const b = UI.sheet.hidden || docked ? 0 : UI.root.clientHeight - rb.top; UI.bao.style.bottom = `calc(${b + 6}px + var(--safe-b))`; }
function showBao(mood = 'ok') { UI.bao.hidden = false; UI.bao.querySelector('img').src = BAO.url[mood]; placeBao(); }
function hideBao() { UI.bao.hidden = true; UI.bao.querySelector('.bub').hidden = true; }
function baoSay(ph, mood = 'happy', ms = 2600) {
  if (!ph) return; showBao(mood); const bub = UI.bao.querySelector('.bub');
  bub.innerHTML = `<b>${esc(ph[0])}</b><i>${esc(ph[1])}</i>${ph[2] ? `<s>${esc(ph[2])}</s>` : ''}`; bub.hidden = false;
  UI.bao.classList.remove('pop'); void UI.bao.offsetWidth; UI.bao.classList.add('pop');
  clearTimeout(baoTimer); baoTimer = setTimeout(() => { bub.hidden = true; if (!UI.bao.hidden) UI.bao.querySelector('img').src = BAO.url.ok; }, ms);
}

// ---------- the typing panel ----------
let tb = null, tbGen = 0;
function typebarHTML() {
  return `<div class="tb"><div class="tb-hint"></div><div class="tb-row"><input class="tb-in" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Type the Yale…">
  <button class="btn sm" data-t="hint" title="Hint (Tab)">${ic('lightbulb')}</button><button class="btn sm" data-t="say" title="Listen (Ctrl+L)">${ic('volume-3')}</button><button class="btn sm gold" data-t="ok" title="Enter">${ic('check')}</button></div>
  ${ST.settings.tones ? `<div class="tb-tones">${[[1, 'ā'], [2, 'á'], [3, 'a'], [4, 'àh'], [5, 'áh'], [6, 'ah']].map(([n, l]) => `<button data-tone="${n}"><b>${l}</b>${n}</button>`).join('')}</div>` : ''}
  <div class="tb-msg"></div></div>`;
}
function hintText(it, n) { return it.syl.map((s, i) => i < n ? esc(s) : '＿'.repeat(Math.max(1, Math.ceil(base(nfd(s)).length / 2)))).join(' · '); }
function askYale(it, opts = {}) {
  return new Promise(resolve => {
    const root = UI.sheet.querySelector('.tb'); if (!root) return resolve({ scored: false });
    const inp = root.querySelector('.tb-in'), hintEl = root.querySelector('.tb-hint'), msg = root.querySelector('.tb-msg');
    let copy = !!opts.copy, hints = 0, firstTry = true, toneErr = false; const gen = ++tbGen;
    hintEl.innerHTML = copy ? `<span class="tone">${esc(it.yale)}</span> <span class="en" style="font-size:12px">← copy it, tone marks too</span>` : hintText(it, 0);
    msg.innerHTML = esc(opts.prompt || (ST.settings.tones || touch ? '' : 'Tip: type tone numbers after a syllable — yau4 → yàuh.'));
    const done = res => { if (gen !== tbGen) return; tb = null; resolve(res); };
    tb = {
      it,
      hint() { if (copy) return; hints++; firstTry = false; sfx('pop'); hintEl.innerHTML = hintText(it, hints); if (hints >= it.syl.length) copy = true; inp.focus(); },
      submit() {
        const r = checkYale(inp.value, it); if (r.empty) return;
        if (r.ok) { inp.className = 'tb-in ok'; const scored = !opts.copy && firstTry && hints === 0; setTimeout(() => done({ scored, copied: !!opts.copy, hinted: hints > 0, toneErr }), 320); tb = null; return; }
        sfx('buzz'); firstTry = false; inp.className = 'tb-in'; void inp.offsetWidth; inp.className = 'tb-in bad';
        if (r.tones) { toneErr = true; msg.innerHTML = 'Tones: ' + r.parts.map(p => `<span class="${p.right ? 'ok' : 'tone'}">${esc(p.syl)}</span>`).join(' ') + ' — the gold syllables need another tone. Type it again.'; }
        else msg.innerHTML = 'Not quite: <span class="tone">' + esc(it.yale) + '</span>. Type it out to continue.';
        oops(r.tones); copy = true; hintEl.innerHTML = `<span class="tone">${esc(it.yale)}</span>`; inp.select();
      },
    };
    root.querySelector('[data-t=ok]').onclick = () => tb && tb.submit();
    root.querySelector('[data-t=hint]').onclick = () => tb && tb.hint();
    root.querySelector('[data-t=say]').onclick = () => say(it);
    root.querySelectorAll('[data-tone]').forEach(b => b.onpointerdown = e => { e.preventDefault(); if (toneInput(inp, +b.dataset.tone)) sfx('pop'); inp.focus(); });
    inp.addEventListener('input', e => { const v = inp.value, p = inp.selectionStart; const d = v.slice(p - 1, p); if (/[1-6]/.test(d) && p > 1) { inp.value = v.slice(0, p - 1) + v.slice(p); inp.setSelectionRange(p - 1, p - 1); toneInput(inp, +d); } inp.classList.remove('bad'); });
    inp.addEventListener('keydown', e => { if (!tb) return; if (e.key === 'Enter') { e.preventDefault(); tb.submit(); } else if (e.key === 'Tab') { e.preventDefault(); tb.hint(); } else if (e.key === 'Escape') { e.preventDefault(); G.home(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); say(it); } e.stopPropagation(); });
    setTimeout(() => { if (!touch || opts.focus) inp.focus({ preventScroll: true }); }, 60);
  });
}
function cancelTyping() { tbGen++; tb = null; }
function oops(tones) { MAP.shake(); baoSay(tones ? SAY.tone[0] : pick(SAY.bad), 'sad', 2000); }

// ---------- fact card ----------
function factHTML(it) {
  const s = stars(it), dist = it.dist ? BY[it.dist] : null, near = it.near ? BY['S:' + it.near] : null, u = photoUrl(it);
  const tags = [`<span class="chip" style="background:${typeColor(it)}">${TYPE[it.t]}</span>`];
  if (dist) tags.push(`<span class="chip" style="background:#3c4680">${esc(dist.hz)} ${esc(dist.yale)}</span>`);
  (it.lines || []).forEach(l => tags.push(`<span class="chip" style="background:${LINES[l].color}">${esc(LINES[l].hz)}</span>`));
  if (near) tags.push(`<span class="chip" style="background:#555">MTR ${esc(near.hz)}</span>`);
  if (it.lv) tags.push(`<span class="chip" style="background:#9a7a1a">Lv ${it.lv}</span>`);
  const ps = photosOf(it), mg = MG_AT[it.k] && s ? MG_AT[it.k] : null;
  return `<div data-k="${esc(it.k)}">${u ? `<img class="ph" alt="" src="${esc(u)}" onerror="this.remove()">` : ''}${ps.length > 1 ? `<div class="gal">${ps.map((p, i) => `<img src="${esc(p.u)}" data-i="${i}" class="${i ? '' : 'on'}" alt="" onerror="this.remove()">`).join('')}</div>` : ''}
  <div class="hz">${esc(it.hz)}</div><div class="yl">${esc(it.yale)}</div><div class="en2">${esc(it.en)}</div><div class="tags">${tags.join('')}</div>
  <div class="tx">${esc(it.fact || '')}</div>${it.more ? `<div class="tx tx2">${esc(it.more)}</div>` : ''}${it.nm ? `<div class="nm"><b>字面 Jihmín</b> ${esc(it.nm)}</div>` : ''}${it.addr ? `<div class="cr">📍 ${esc(it.addr)}</div>` : ''}
  <div class="wiki" hidden></div><div class="row" style="margin-top:8px"><button class="btn sm" data-a="say">${ic('volume-3')} 聽</button><button class="btn sm" data-wiki="1">${ic('book-open')} 更多</button>${mg ? `<button class="btn sm gold" data-playmg="${mg}">${ic('gamepad')} ${MG[mg].zh}</button>` : ''}<span class="spacer"></span><span class="stars">${starStr(s)}${mastered(it) ? ' 識' : ''}</span><button class="btn sm" data-a="x">${ic('close')}</button></div>${u ? `<div class="cr pcr">${credit_(it)}</div>` : ''}</div>`;
}
let factIt = null;
function factMini(it) {
  const s = stars(it), dist = it.dist ? BY[it.dist] : null, u = photoUrl(it);
  const ps = photosOf(it), mg = MG_AT[it.k] && s ? MG_AT[it.k] : null;
  return `<div data-k="${esc(it.k)}"><div class="fmini">${u ? `<span class="fthw"><img class="fth" alt="" src="${esc(u)}" onerror="this.remove()">${ps.length > 1 ? `<i>${ps.length}</i>` : ''}</span>` : ''}<div class="fmain">
    <div class="row"><span class="chip" style="background:${typeColor(it)}">${TYPE[it.t]}</span>${dist ? `<span class="en fdist">${esc(dist.hz)} ${esc(dist.yale)}</span>` : ''}<span class="spacer"></span><button class="iconbtn" data-a="x">${ic('close')}</button></div>
    <div class="fhz">${esc(it.hz)}</div><div class="fyl">${esc(it.yale)}</div><div class="fen">${esc(it.en)}</div></div></div>
    ${it.fact ? `<div class="ftx">${esc(it.fact)}</div>` : ''}${it.nm ? `<div class="nm"><b>字面</b> ${esc(it.nm)}</div>` : ''}${it.more ? `<details class="fmore"><summary>More ▾</summary>${esc(it.more)}</details>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sm" data-a="say">${ic('volume-3')} 聽 Tēng</button>${mg ? `<button class="btn sm gold" data-playmg="${mg}">${ic('gamepad')} ${MG[mg].zh}</button>` : ''}<span class="spacer"></span><span class="stars">${starStr(s)}${mastered(it) ? ' 識' : ''}</span></div>
    ${u ? `<div class="fcr pcr">${credit_(it)}</div>` : ''}</div>`;
}
function showFact(it) { factIt = it; if (innerWidth <= 700 || innerHeight <= 500) { setSheet(`<div class="paper fsheet" id="factsheet">${factMini(it)}</div>`); document.body.classList.add('factopen'); bind(UI.sheet, { say: () => say(it), x: hideFact }); } else { setSide(factHTML(it), 'paper fcard'); bind(UI.side, { say: () => say(it), x: hideFact }); } }
function hideFact() { document.body.classList.remove('factopen'); if (!factIt) return; factIt = null; if ($('#factsheet')) setSheet(null); setSide(null); }

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
function lineBounds(id) { const pts = LINES[id].seq.flat().map(c => BY['S:' + c]); return [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))]; }
function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) c = !c; } return c; }
const DISTS = ITEMS.filter(i => i.t === 'd');
const AREA_BY = {}; for (const [k, v] of Object.entries(DATA.areaIdx || {})) AREA_BY[v[0] + ':' + v[1]] = k;
/* which district (ch 0) or region (ch 1) is under this point? read from the pixel-exact area picture; a tap just off the coast counts for the nearest shore */
function areaKeyAt(x, y, ch) { const v = MAP && MAP.areaVal(x, y, ch); return v ? AREA_BY[ch + ':' + v] || null : null; }
const districtAt = (x, y) => { const k = areaKeyAt(x, y, 0); return k ? DISTS.find(d => d.k === k) || null : DISTS.find(d => inPoly({ x, y }, GEO[d.k].poly)) || null; };
function rideStops(id) { const out = [], seen = new Set(); for (const seg of LINES[id].seq) { let prev = null; for (const c of seg) { const it = BY['S:' + c]; if (!seen.has(c)) { out.push({ it, from: prev }); seen.add(c); } prev = it; } } return out; }
const lineOf = it => it.t === 's' ? it.lines[0] : null;

// ---------- the game ----------
const G = {
  mode: 'boot', geoLabels: true, geoBorders: true, tick: null, run: 0,
  boot() {
    $('#boot').remove(); clearUI(); MAP.setRules(() => false); MAP.fitAll({ dur: 0 });
    const sp = $('#splash'); sp.hidden = false; let gone = false;
    // iPhone: audio may only start inside a click/touchend, and Tone.start() can stay pending, so never wait for it
    const go = e => { if (gone) return; gone = true; sp.hidden = true; window.removeEventListener('keydown', go, true); sp.removeEventListener('click', go); if (e) { e.preventDefault(); e.stopPropagation(); } MUSIC.unlock(); if (ANKI && DIR && !dirOK) reconnectFolder(true); G.home(); };
    window.addEventListener('keydown', go, true); sp.addEventListener('click', go);
  },
  enter(mode) { document.body.classList.remove('roam', 'factopen'); try { MAP.cam.panEffect.reset(); MAP.cam.zoomEffect.reset(); MAP.lastFit = null; } catch (e) {} G.run++; G.mode = mode; G.tick = null; cancelTyping(); clearUI(); MAP.clearFx(); MAP.drag = false; MAP.wheelOK = false; MAP.onTap = null; MAP.labelMinZ = 0; G.geoLabels = true; G.geoBorders = true; factIt = null; return G.run; },
  alive(run) { return run === G.run; },
  zoomButtons(bottom = 0) { show(UI.zoom, `<button class="btn" data-a="in">${ic('plus')}</button><button class="btn" data-a="out">${ic('minus')}</button>`); UI.zoom.style.bottom = `calc(${bottom + 12}px + var(--safe-b))`; bind(UI.zoom, { in: () => MAP.zoomBy(1.35), out: () => MAP.zoomBy(0.74) }); },

  // ----- home -----
  home() {
    G.enter('home'); MUSIC.play('title'); MAP.setRules(() => false);
    const x = xp(), ri = rankOf(x), R = RANKS[ri], N = RANKS[ri + 1], nx = nextStep(), L = nx.L, S = levelStats(L);
    const seen = ITEMS.filter(i => stars(i)).length, due = ITEMS.filter(i => stars(i) && !mastered(i)).length, ready = ANKI ? ankiReady().length : 0;
    const pct = N ? Math.round(100 * (x - R[0]) / (N[0] - R[0])) : 100, ms = missionsToday(), md = ms.filter(m => m.done).length;
    setCenter(`<div class="home panel">
      <div class="logo">香港通</div><div class="logo-sub">Hēunggóng Tūng · learn Hong Kong's places in Yale</div>
      <button class="cont" data-a="go">
        <span class="lvtag">Level ${L.n} / ${LEVELS.length}</span>
        <span class="cz">${esc(L.zh)} <span class="y">${esc(L.yale)}</span></span><span class="en">${esc(L.en)}</span>
        <span class="pgbar"><i style="width:${100 * (S.met + S.two) / (2 * S.n)}%"></i></span>
        <span class="cgo">${ic('play')}<b>${nx.zh}</b><span>${nx.yale} · ${nx.sub}</span></span>
      </button>
      <div class="row lnk"><button class="link" data-a="journey">${ic('flag')} All levels</button><span class="spacer"></span><span class="en">${R[1]} ${R[2]} · ${ic('fire')}${streak()}</span></div>
      <div class="xp"><i style="width:${pct}%"></i></div>
      <div class="qrow">
        <button class="btn" data-a="practice" ${seen ? '' : 'disabled'}>${ic('target')}<span class="lbl"><b>練習</b><small>Practice${due ? ' · ' + due : ''}</small></span></button>
        <button class="btn" data-a="roam">${ic('human')}<span class="lbl"><b>漫遊</b><small>Explore</small></span></button>
        <button class="btn" data-a="col">${ic('book-open')}<span class="lbl"><b>圖鑑</b><small>Collection</small></span></button>
      </div>
      <details class="more"><summary>${ic('more-horizontal')} More · 今日任務 ${md}/${ms.length}${ready ? ` · <span class="y">Anki ${ready}</span>` : ''}</summary>
        <div class="qrow">
          <button class="btn sm" data-a="rush" ${seen >= 4 ? '' : 'disabled'}>${ic('zap')}<span class="lbl"><b>繁忙時間</b><small>Rush hour</small></span></button>
          <button class="btn sm" data-a="ride">${ic('map')}<span class="lbl"><b>乘車</b><small>Ride a line</small></span></button>
          <button class="btn sm" data-a="set">${ic('settings-cog')}<span class="lbl"><b>設定</b><small>Settings</small></span></button>
          <button class="btn sm" data-a="minis">${ic('gamepad')}<span class="lbl"><b>小遊戲</b><small>Mini-games</small></span></button><button class="btn sm" data-a="snk">${ic('coffee')}<span class="lbl"><b>小食</b><small>Snacks ${SNACKS.filter(x => (ST.flags.snk || {})[x[0]]).length}/${SNACKS.length}</small></span></button>
        </div>
        <div class="missions"><div class="row"><span>今日任務 <span class="y">Gāmyaht yahmmouh</span></span><span class="spacer"></span><span class="en">+30 each</span></div>
        ${ms.map(m => `<div class="mis ${m.done ? 'done' : ''}"><span class="box"></span><div style="flex:1"><div>${esc(MISSIONS[m.id].en)}</div><div class="pb"><i style="width:${100 * m.n / MISSIONS[m.id].goal}%"></i></div></div><span class="en">${m.n}/${MISSIONS[m.id].goal}</span></div>`).join('')}</div>
        <div class="en" style="margin-top:8px">${N ? x + ' / ' + N[0] + ' XP to ' + N[1] + ' ' + N[2] : x + ' XP'} · today ${ST.points[today()] || 0}${touch ? '' : ' · keys: Enter, 1–7, M music'}</div>
      </details></div>`);
    const go = { go: nx.go, journey: () => G.journey(), practice: () => G.practice(), rush: () => G.rush(), roam: () => G.roam(), col: () => openCollection(), ride: () => G.pickRide(), set: () => openSettings(), minis: () => openMinis(), snk: () => openSnackBook() };
    if (!touch && innerWidth > 900 && innerHeight > 600) { // computer: a slow drift over the harbour behind the menu
      const z0 = Math.max(2.2, innerWidth / 520), path = ['S:TST', 'S:CEN', 'S:TSY', 'S:KOT', 'S:NOP', 'S:ADM'].map(k => BY[k]).filter(Boolean);
      let t = (ST.homeT || 0); MAP.cam.setZoom(z0);
      const at = t => { const n = path.length, i = Math.floor(t) % n, f = t - Math.floor(t), a = path[i], b = path[(i + 1) % n], e = f * f * (3 - 2 * f); return [a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e]; };
      const p0 = at(t); MAP.cam.centerOn(p0[0], p0[1]);
      G.tick = dt => { t += dt / 26000; ST.homeT = t % path.length; const p = at(t); MAP.cam.centerOn(p[0], p[1]); };
    } else { requestAnimationFrame(() => MAP.fitAll()); const det = UI.center.querySelector('details'); if (det) det.ontoggle = () => MAP.fitAll(); }
    bind(UI.center, go); KEYS = { Enter: go.go, 1: go.journey, 2: () => seen && go.practice(), 3: () => seen >= 4 && go.rush(), 4: go.roam, 5: go.col, 6: go.ride, 7: go.set };
    if (!ST.flags.intro && innerWidth > 700 && innerHeight > 500) { ST.flags.intro = 1; save(); setTimeout(() => G.mode === 'home' && baoSay(['你好！我係包仔。', 'Néih hóu! Ngóh haih Bāaujái.', "Hi! I'm Bāaujái. Tap the big button to start."], 'happy', 4200), 500); }
    else setTimeout(() => G.mode === 'home' && innerWidth > 900 && baoSay(pick(SAY.hi), 'happy'), 500);
  },

  // ----- journey: levels as a metro line (done, current and the next two; the rest folded away) -----
  journey(showAll) {
    G.enter('journey'); MUSIC.play('title'); MAP.setRules(() => false); MAP.fitAll();
    const cur = currentLevel(), shown = LEVELS.filter(L => showAll || L.n <= cur.n + 2), hid = LEVELS.length - shown.length;
    setCenter(`<div class="menu panel"><div class="hd">${ic('flag')}<h2>旅程 <span class="y">Léuihchìhng</span></h2><button class="iconbtn" data-a="home" title="Home (Esc)">${ic('close')}</button></div>
      <p class="en" style="margin:6px 0 0;line-height:1.5">Meet every place in a level, then get ★★ on most of them to open the next.</p>
      <div class="metro">${shown.map(L => { const S = levelStats(L), un = unlocked(L.n), c = L === cur && !S.cleared;
        return `<div class="lv ${S.cleared ? 'done' : ''} ${c ? 'cur' : ''} ${un ? '' : 'locked'}" data-lv="${L.n}" id="lv${L.n}"><span class="st">${S.cleared ? '識' : L.n}</span><div class="ti"><div><span class="lz">${esc(L.zh)}</span> <span class="y">${esc(L.yale)}</span></div><div class="en">${esc(L.en)}</div></div>
        <div class="pg">${un ? `${S.met}/${S.n}<div class="pgbar"><i style="width:${100 * S.met / S.n}%"></i></div>` : gatePending(L.n) ? `<span class="gate">${ic('gamepad')} ${MG[MG_GATE[L.n]].zh}</span>` : ic('lock')}</div></div>`; }).join('')}
        ${hid ? `<div class="lv locked more-lv" data-a="all"><span class="st">⋯</span><div class="ti en">${hid} more levels · tap to see them</div></div>` : ''}</div></div>`);
    bind(UI.center, { home: () => G.home(), all: () => G.journey(true) });
    UI.center.querySelectorAll('[data-lv]').forEach(el => el.onclick = () => { const L = LEVELS[el.dataset.lv - 1]; sfx('blip'); if (unlocked(L.n)) G.level(L); else if (gatePending(L.n)) runMini(MG_GATE[L.n], { gate: L.n }).then(() => G.journey()); else toast('Level ' + L.n + ' is locked', '', 'Clear level ' + (L.n - 1) + ' first.'); });
    setTimeout(() => { const el = $('#lv' + cur.n); if (el) el.scrollIntoView({ block: 'center' }); }, 30);
    KEYS = { Escape: () => G.home(), Enter: () => G.level(cur) };
  },
  level(L) {
    G.enter('level'); MUSIC.play('title'); const S = levelStats(L), keys = new Set(L.keys), need = Math.max(0, Math.ceil(S.n * 0.7) - S.two);
    MAP.setRules(it => keys.has(it.k) ? (stars(it) ? true : 'faint') : false, it => keys.has(it.k) && stars(it) > 0);
    const tip = S.cleared ? 'Cleared 識 — tour again or practise any time.' : S.met < S.n ? `Tour the level to meet ${S.n - S.met} new place${S.n - S.met > 1 ? 's' : ''}.` : `Now practise: ★★ on ${need} more to clear it.`;
    setSheet(`<div class="row"><span class="y">Level ${L.n}</span><span class="spacer"></span><button class="iconbtn" data-a="back" title="Back (Esc)">${ic('close')}</button></div>
      <div class="row" style="align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:-8px"><span class="big">${esc(L.zh)}</span><span class="y">${esc(L.yale)}</span><span class="en">${esc(L.en)}</span></div>
      <div class="pgbar" style="margin-top:8px;height:8px"><i style="width:${100 * (S.met + S.two) / (2 * S.n)}%"></i></div>
      <div class="en" style="margin-top:6px">Met ${S.met}/${S.n} · ★★ ${S.two}/${S.n} · ${tip}</div>
      <div class="lvbtns"><button class="btn ${S.met < S.n || S.cleared ? 'primary' : ''}" data-a="tour">${ic('play')}<span class="lbl"><b>出發</b><small>Chēutfaat · tour</small></span></button>
      <button class="btn ${S.met === S.n && !S.cleared ? 'primary' : ''}" data-a="prac" ${S.met ? '' : 'disabled'}>${ic('target')}<span class="lbl"><b>練習</b><small>Lihnjaahp · practise</small></span></button></div>`);
    const pts = []; S.its.forEach(i => { if (isArea(i)) { const b = GEO[i.k].bb; pts.push([b[0], b[1]], [b[2], b[3]]); } else if (i.t === 'l') { const b = lineBounds(i.k.slice(2)); pts.push([b[0], b[1]], [b[2], b[3]]); } else pts.push([i.x, i.y]); });
    requestAnimationFrame(() => MAP.fit([Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))], { maxZ: 4.5 }));
    const go = { tour: () => G.ride({ type: 'level', n: L.n }), prac: () => S.met && G.practice({ type: 'level', n: L.n }), back: () => G.journey() };
    bind(UI.sheet, go); KEYS = { 1: go.tour, 2: go.prac, Escape: go.back, Enter: S.met === S.n && !S.cleared ? go.prac : go.tour };
    MAP.drag = true; MAP.wheelOK = true;
  },
  pickRide() {
    G.enter('pick'); MUSIC.play('title'); MAP.setRules(() => false); MAP.fitAll();
    const all = [...Object.keys(LINES).map(id => ({ id, type: 'line' })), ...DATA.tours.map(t => ({ id: t.id, type: 'tour' }))];
    setCenter(`<div class="menu panel"><div class="hd">${ic('map')}<h2>乘車 <span class="y">Sìhngchē</span></h2><button class="iconbtn" data-a="home">${ic('close')}</button></div>
      <p class="en" style="margin:6px 0 0">Ride a whole MTR line stop by stop, or take a sightseeing bus.</p>
      <div class="ridegrid">${all.map((r, n) => { const isL = r.type === 'line', L = isL ? LINES[r.id] : DATA.tours.find(t => t.id === r.id), its = isL ? rideStops(r.id).map(s => s.it).concat([BY['L:' + r.id]]) : L.items.map(k => BY[k]); const met = its.filter(i => stars(i)).length;
        return `<button class="btn" data-r="${n}" style="border-left-color:${isL ? L.color : '#c0862f'}"><span class="big">${isL ? esc(L.hz) : '觀光 ' + r.id.slice(1)}</span><small class="en">${esc(L.en)}</small><small class="y">${met}/${its.length} met</small></button>`; }).join('')}</div></div>`);
    bind(UI.center, { home: () => G.home() }); UI.center.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { sfx('blip'); G.ride(all[+b.dataset.r]); });
    KEYS = { Escape: () => G.home() };
  },

  // ----- rides & tours -----
  async ride(r) {
    const run = G.enter('ride'); let stops, title, color, kind;
    if (r.type === 'line') { const L = LINES[r.id]; stops = [{ it: BY['L:' + r.id], isLine: true }, ...rideStops(r.id)]; color = L.color; title = L.hz + ' ' + L.yale; kind = 'train'; }
    else if (r.type === 'level') { const L = LEVELS[r.n - 1]; let prev = null; stops = L.keys.map(k => { const it = BY[k], s = { it, from: prev, isLine: it.t === 'l', area: isArea(it) }; if (!s.isLine && !s.area) prev = it; return s; }); color = '#f6c945'; title = 'Lv ' + r.n + ' · ' + L.zh + ' ' + L.yale; kind = 'walk'; }
    else { const T = DATA.tours.find(t => t.id === r.id); let prev = null; stops = T.items.map(k => { const s = { it: BY[k], from: prev }; prev = BY[k]; return s; }); color = '#c0862f'; title = '觀光 ' + T.en; kind = 'bus'; }
    const keys = new Set(stops.map(s => s.it.k));
    MAP.setRules(it => keys.has(it.k) ? (stars(it) ? true : 'faint') : false, it => keys.has(it.k) && stars(it) > 0);
    MUSIC.play('ride'); MUSIC.jingle('doors'); KEYS = { Escape: () => G.home() };
    const real = stops.filter(s => !s.isLine); let met = 0, recalled = 0, asked = 0, pts = 0;
    for (let i = 0; i < stops.length; i++) {
      if (!G.alive(run)) return;
      const st = stops[i], it = st.it, idx = real.indexOf(st);
      setHud(`<button class="iconbtn panel" data-a="home" title="Home (Esc)">${ic('home')}</button><div class="bar panel"><span class="t y">${esc(title)}</span><div class="dots">${real.map((s, j) => `<i class="${j < idx ? 'd' : j === idx ? 'c' : ''}"></i>`).join('')}</div></div>`);
      bind(UI.hud, { home: () => G.home() });
      MAP.clearFx();
      if (st.isLine) { MAP.highlightLine(it.k.slice(2)); }
      else if (st.area) { MAP.highlightArea(it.k); }
      else {
        if (r.type === 'line') MAP.highlightLine(r.id);
        const from = st.from || it;
        if (from !== it) {
          setSheet(null); const nb = `<span class="y">下一站 Hah yāt jaahm</span> ▸ <span class="big">${esc(it.hz)}</span>`;
          banner(nb, 'panel'); sfx('whoosh');
          MAP.cam.zoomTo(it.dense ? 4.5 : 3.2, 500, 'Sine.easeInOut', true);
          await MAP.travel(from, it, kind, color); if (!G.alive(run)) return; MUSIC.jingle('arrive');
        }
        MAP.fx.list.filter(o => o.texture && /^(train|bus|tour)/.test(o.texture.key)).forEach(o => o.destroy());
        MAP.pin(it);
      }
      const s = await G.stopCard(it, i === 0 && st.isLine, run); if (!s) return;
      met += s.met; recalled += s.rec; asked += s.ask; pts += s.pts;
      await sleep(s.rec || s.met ? 700 : 1100);
    }
    if (!G.alive(run)) return;
    mission('ride');
    let cleared = null;
    if (r.type === 'level' && levelStats(LEVELS[r.n - 1]).cleared && !ST.levels[r.n + 1] && r.n < LEVELS.length) { ST.levels[r.n + 1] = 1; save(); cleared = LEVELS[r.n]; }
    G.end('到站！', 'Dou jaahm!', title, [met ? 'New names met: ' + met : '', asked ? 'From memory: ' + recalled + ' / ' + asked : '', '+' + pts + ' points'].filter(Boolean),
      [['練習', 'Practise these', () => G.practice(r), 'Enter'], [r.type === 'level' ? '旅程' : '再乘', r.type === 'level' ? 'Journey' : 'Another ride', () => r.type === 'level' ? G.journey() : G.pickRide(), '1'], ['主頁', 'Home', () => G.home(), 'Escape']]);
    if (cleared) setTimeout(() => { MUSIC.jingle('level'); toast('過關！ Gwo gwāan!', 'Level ' + r.n + ' clear', 'Next stop unlocked: ' + cleared.zh + ' · ' + cleared.en, 3800); burst(0.5, 0.3, 100); }, 900);
  },
  stopCard(it, intro, run) {
    return new Promise(async resolve => {
      const r = rec(it.k), isNew = !r.s, u = photoUrl(it), long = it.hz.length > 5;
      const chips = [];
      if (it.t === 's') it.lines.forEach(l => chips.push(`<span class="chip" style="background:${LINES[l].color}">${esc(LINES[l].hz)} ${esc(LINES[l].yale)}</span>`));
      if (it.t === 'l') chips.push(`<span class="chip" style="background:${LINES[it.k.slice(2)].color}">${esc(it.hz)}</span>`);
      if (it.dist && BY[it.dist]) chips.push(`<span class="chip" style="background:#3c4680">${esc(BY[it.dist].hz)}</span>`);
      if ((it.t === 'p' || it.t === 'c') && it.near) chips.push(`<span class="chip" style="background:#555">MTR ${esc(BY['S:' + it.near].hz)} ${esc(BY['S:' + it.near].yale)}</span>`);
      setSheet(`<div class="band" style="background:${typeColor(it)}"></div>
        <div class="stop">${u ? `<img class="thumb" alt="" src="${esc(u)}" onerror="this.remove()">` : ''}<div class="main">
        <div class="row"><span class="badge ${isNew ? '' : 'seen'}">${isNew ? '新！ Sān! · new name' : '見過 Gingwo · from memory'}</span><span class="spacer"></span><span class="stars">${starStr(stars(it))}</span></div>
        <div class="row" style="align-items:baseline;gap:12px;flex-wrap:wrap"><span class="hz ${long ? 'long' : ''}" style="font-size:${long ? 24 : 48}px">${esc(it.hz)}</span><span class="en">${esc(it.en)}</span></div>
        <div class="meta">${chips.join('')}</div>${it.fact ? `<div class="fact">${esc(it.fact)}</div>` : ''}</div></div>${typebarHTML()}`);
      if (u && innerWidth > 700 && innerHeight > 500) setSide(`<img class="ph" alt="" src="${esc(u)}" onerror="this.parentNode.hidden=true"><div class="cap">${esc(it.hz)}</div><div class="cr">${credit_(it)}</div>`, 'paper polaroid');
      requestAnimationFrame(() => MAP.fitItem(it, { r: it.dense ? 30 : 45 }));
      showBao(); if (intro) baoSay([SAY.go[0][0], SAY.go[0][1], "Let's go! First, the name of the line."]);
      say(it);
      const res = await askYale(it, { copy: isNew, prompt: isNew ? 'New name: type it exactly as shown, tone marks too.' : '' });
      if (!G.alive(run)) return resolve(null);
      const s = { met: 0, rec: 0, ask: 0, pts: 0 };
      if (isNew) { meet(it); s.met = 1; s.pts = 2; mission('newn'); sfx('sparkle'); if (Math.random() < 0.35) baoSay(pick(SAY.good)); }
      else { s.ask = 1; if (res.scored) { credit(it, 'y'); s.rec = 1; s.pts = 10; mission('type'); sfx('coin'); burst(0.5, 0.75, 26); baoSay(pick(SAY.good)); } else { s.pts = 1; if (!res.hinted) debit(it, 'y'); } }
      addPoints(s.pts); save(); MAP.refresh(); if (!isArea(it) && it.t !== 'l') MAP.label(it, res.scored || isNew);
      resolve(s);
    });
  },
  end(zh, yale, sub, lines, buttons) {
    G.enter('end'); MAP.setRules(it => stars(it) > 0, () => false); MAP.fitAll(); MUSIC.jingle('win');
    setCenter(`<div class="end panel"><div class="huge ok">${esc(zh)}</div><div class="big y">${esc(yale)}</div><div class="en" style="margin-top:4px">${esc(sub || '')}</div>
      <div style="margin-top:12px;line-height:1.8">${lines.map(l => `<div class="big">${esc(l)}</div>`).join('')}</div>
      <div class="btns">${buttons.map((b, i) => `<button class="btn ${i ? '' : 'primary'}" data-a="b${i}"><span class="lbl"><b>${esc(b[0])}</b><small>${esc(b[1])}</small></span></button>`).join('')}</div></div>`);
    const map = {}; buttons.forEach((b, i) => { map['b' + i] = b[2]; KEYS[b[3]] = b[2]; }); bind(UI.center, map);
    setTimeout(() => burst(0.5, 0.35, 70), 150); showBao('happy'); baoSay(pick(SAY.good));
  },

  // ----- practice: find it on the map, type it -----
  async practice(only) {
    const run = G.enter('practice'); const d = today();
    let pool = ITEMS.filter(i => stars(i));
    if (only) { const keys = only.type === 'line' ? new Set(['L:' + only.id, ...rideStops(only.id).map(s => s.it.k)]) : only.type === 'level' ? new Set(LEVELS[only.n - 1].keys) : new Set(DATA.tours.find(t => t.id === only.id).items); pool = pool.filter(i => keys.has(i.k)); }
    if (!pool.length) return G.journey();
    MUSIC.play('practice');
    const score = i => { const r = ST.items[i.k]; return (mastered(i) ? 100 : 0) + (r.lastDay === d ? 5 : 0) + (r.l || 0) + (r.y || 0) + Math.random() * 2; };
    pool.sort((a, b) => score(a) - score(b));
    const qs = shuffle(pool.slice(0, 10)).map(it => { const r = ST.items[it.k]; return { it, type: it.t === 'l' ? 'type' : (r.l || 0) <= (r.y || 0) ? 'find' : 'type' }; });
    let combo = 0, got = 0, pts = 0, best = 0;
    for (let n = 0; n < qs.length; n++) {
      if (!G.alive(run)) return;
      const q = qs[n], ok = q.type === 'find' ? await G.qFind(q.it, n, qs.length, combo, run) : await G.qType(q.it, n, qs.length, combo, run);
      if (ok == null || !G.alive(run)) return;
      if (ok) { got++; combo++; best = Math.max(best, combo); mission('combo', combo, true); } else combo = 0;
      const p = ok ? 5 + Math.min(combo, 5) * 2 : 0; pts += p; addPoints(p); save();
      if (ok) { sfx('coin', 1 + Math.min(combo, 8) * 0.07); toastMini('+' + p + (combo > 1 ? '  連擊 ×' + combo : '')); }
      if (q.type === 'type') await sleep(ok ? 700 : 1100);
    }
    const newM = ANKI ? ankiReady().length : 0;
    G.end(got === qs.length ? '全啱！' : got + ' / ' + qs.length, got === qs.length ? 'Chyùhn ngāam!' : 'Lihnjaahp yùhn', '', ['+' + pts + ' points · best combo ×' + best, newM ? newM + ' ready for Anki' : ''].filter(Boolean),
      [['再練', 'More practice', () => G.practice(only), 'Enter'], ['旅程', 'Journey', () => G.journey(), '1'], ['主頁', 'Home', () => G.home(), 'Escape']]);
  },
  qHud(zh, sub, n, total, combo) {
    setHud(`<button class="iconbtn panel" data-a="home" title="Home (Esc)">${ic('home')}</button><div class="q panel"><div class="big">${zh}</div><div class="en">${sub}</div></div><div class="panel" style="padding:8px 10px;text-align:right;min-width:64px"><div class="y">${n + 1}/${total}</div>${combo > 1 ? `<div class="ok">×${combo}</div>` : ''}</div>`);
    bind(UI.hud, { home: () => G.home() }); KEYS = { Escape: () => G.home() };
  },
  qFind(it, n, total, combo, run) {
    return new Promise(resolve => {
      G.mode = 'find'; setSheet(null); setSide(null); MAP.clearFx(); hideBao();
      const area = isArea(it); G.geoLabels = false; G.geoBorders = !area;
      MAP.setRules(o => !area && o.t === it.t ? (stars(o) ? true : 'faint') : false, () => false);
      G.qHud(`「${esc(it.hz)}」喺邊度？ <span class="y" style="font-size:12px">Hái bīndouh?</span>`, `${esc(it.yale)} · ${esc(it.en)} — ${area ? 'tap anywhere inside it' : 'tap its spot on the map'}`, n, total, combo);
      MAP.drag = true; MAP.wheelOK = true; G.zoomButtons();
      const zoom = area ? (it.t === 'r' ? 0.9 : 1.3) : (it.t === 'p' || it.t === 'c') && it.dense ? 3.2 : it.t === 'p' || it.t === 'c' ? 1.6 : 2.1;
      const off = area ? 0 : 120 / zoom, ang = Math.random() * Math.PI * 2, cx = area ? 640 : it.x, cy = area ? 430 : it.y;
      requestAnimationFrame(() => MAP.fit([cx + Math.cos(ang) * off - 160 / zoom, cy + Math.sin(ang) * off - 100 / zoom, cx + Math.cos(ang) * off + 160 / zoom, cy + Math.sin(ang) * off + 100 / zoom], { maxZ: zoom, minZ: Math.min(zoom, 0.5) }));
      say(it);
      MAP.onTap = wp => {
        MAP.onTap = null; MAP.drag = false; show(UI.zoom, null); let ok, verdict, info;
        if (area) {
          const ch = DATA.areaIdx && DATA.areaIdx[it.k] ? DATA.areaIdx[it.k][0] : -1, at = ch >= 0 ? areaKeyAt(wp.x, wp.y, ch) : null; ok = ch >= 0 ? at === it.k : inPoly(wp, GEO[it.k].poly); const hit = it.t === 'r' && at ? BY[at] || districtAt(wp.x, wp.y) : districtAt(wp.x, wp.y);
          MAP.highlightArea(it.k, ok ? 0x5cc46a : 0xf6c945, 0.5); MAP.mark(wp.x, wp.y, ok); MAP.label(it, ok);
          verdict = ok ? '正！ Jeng! 啱晒 Ngāamsaai!' : '唔係呢度 M̀haih nīdouh'; info = ok ? it.fact : 'You tapped ' + (hit ? hit.hz + ' ' + hit.yale : 'outside Hong Kong') + '. ' + it.hz + ' is the gold area.';
          if (ok) { credit(it, 'l'); mission('find'); } else debit(it, 'l');
          const b = GEO[it.k].bb; requestAnimationFrame(() => MAP.fit([Math.min(b[0], wp.x), Math.min(b[1], wp.y), Math.max(b[2], wp.x), Math.max(b[3], wp.y)], { maxZ: 4 }));
        } else {
          const dm = Math.hypot(wp.x - it.x, wp.y - it.y) * PX_M;
          const near = ITEMS.filter(o => o.t === it.t).reduce((a, o) => Math.hypot(wp.x - o.x, wp.y - o.y) < Math.hypot(wp.x - a.x, wp.y - a.y) ? o : a, it);
          ok = dm <= 400 || (near === it && dm <= 1500); const st = dm <= 250 ? 3 : dm <= 700 ? 2 : 1;
          MAP.mark(wp.x, wp.y, ok); MAP.line(wp.x, wp.y, it.x, it.y, ok); MAP.pin(it); MAP.label(it, ok); MAP.pop(ok ? it.x : wp.x, ok ? it.y : wp.y, ok, ok ? 6 + st * 6 : 8);
          verdict = ok ? (st === 3 ? '正！ Jeng! ★★★ spot on' : st === 2 ? '好近！ Hóu káhn! ★★' : '差唔多 Chā m̀dō ★') : '唔係呢度 M̀haih nīdouh';
          const dist = dm < 1000 ? Math.round(dm / 10) * 10 + ' m' : (dm / 1000).toFixed(1) + ' km';
          info = (ok ? '' : 'It was ' + dist + ' away. ') + (it.fact || '');
          if (ok) { credit(it, 'l'); mission('find'); if (st === 3) { mission('star3'); burst(0.5, 0.6, 30); } } else debit(it, 'l');
          requestAnimationFrame(() => MAP.fit([Math.min(wp.x, it.x) - 20, Math.min(wp.y, it.y) - 20, Math.max(wp.x, it.x) + 20, Math.max(wp.y, it.y) + 20], { maxZ: 5 }));
        }
        if (!ok) { sfx('buzz'); MAP.shake(); }
        save(); MAP.refresh(); say(it);
        const u = photoUrl(it);
        setSheet(`<div class="stop">${u ? `<img class="thumb" style="display:block" alt="" src="${esc(u)}" onerror="this.remove()">` : ''}<div class="main"><div class="big ${ok ? 'ok' : 'bad'}">${verdict}</div>
          <div class="row" style="gap:10px;flex-wrap:wrap;align-items:baseline"><span class="big">${esc(it.hz)}</span><span class="y">${esc(it.yale)}</span><span class="stars">${starStr(stars(it))}</span></div><div class="fact">${esc(info || '')}</div></div>
          <button class="btn gold" data-a="next" style="align-self:center">${ic('arrow-right')}<span class="kbd">Enter</span></button></div>`);
        showBao(ok ? 'happy' : 'sad'); baoSay(ok ? pick(SAY.good) : pick(SAY.bad), ok ? 'happy' : 'sad');
        const nx = () => { KEYS = {}; resolve(ok); }; bind(UI.sheet, { next: nx }); KEYS = { Enter: nx, ' ': nx, Escape: () => G.home() };
      };
    });
  },
  async qType(it, n, total, combo, run) {
    G.mode = 'type'; MAP.clearFx(); G.geoLabels = false; MAP.setRules(() => false);
    if (it.t === 'l') { MAP.highlightLine(it.k.slice(2)); G.qHud('呢條係咩綫？ <span class="y" style="font-size:12px">Nī tìuh haih mē sin?</span>', 'Which line is highlighted? Type its name.', n, total, combo); }
    else if (isArea(it)) { MAP.highlightArea(it.k); G.qHud('呢個係咩區？ <span class="y" style="font-size:12px">Nī go haih mē kēui?</span>', 'Which ' + (it.t === 'r' ? 'region' : 'district') + ' is highlighted?', n, total, combo); }
    else { MAP.pin(it); G.qHud(`「${esc(it.hz)}」點讀？ <span class="y" style="font-size:12px">Dím duhk?</span>`, esc(it.en) + ' — type the Yale', n, total, combo); }
    const u = photoUrl(it);
    setSheet(`${(it.t === 'l' || isArea(it)) ? '' : `<div class="stop">${u ? `<img class="thumb" alt="" src="${esc(u)}" onerror="this.remove()">` : ''}<div class="main"><span class="huge">${esc(it.hz)}</span><div class="en">${esc(it.en)}</div></div></div>`}${typebarHTML()}`);
    if (u && innerWidth > 700 && innerHeight > 500 && it.t !== 'l') setSide(`<img class="ph" alt="" src="${esc(u)}" onerror="this.parentNode.hidden=true"><div class="cap">${esc(it.hz)}</div><div class="cr">${credit_(it)}</div>`, 'paper polaroid');
    requestAnimationFrame(() => MAP.fitItem(it, { r: 40 })); showBao();
    const res = await askYale(it, {}); if (!G.alive(run)) return null;
    if (res.scored) { credit(it, 'y'); mission('type'); baoSay(pick(SAY.good)); } else if (!res.hinted) debit(it, 'y');
    save(); say(it); if (it.t !== 'l' && !isArea(it)) MAP.label(it, res.scored);
    return res.scored;
  },

  // ----- rush hour -----
  async rush() {
    const run = G.enter('rush'); const pool = ITEMS.filter(i => stars(i)); if (pool.length < 4) return G.journey();
    MUSIC.play('rush'); let left = 75000, last = performance.now(), score = 0, combo = 0, prev = null, answered = 0, correct = 0, fast = false, ended = false;
    MAP.setRules(() => false); G.geoLabels = false;
    const hud = () => { setHud(`<button class="iconbtn panel" data-a="home">${ic('home')}</button><div class="q panel"><div class="row"><span class="big">繁忙時間</span><span class="y">Fàahnmòhng sìhgaan</span><span class="spacer"></span><span class="big y" id="rs">${score}</span></div><div class="timer" id="rt"><i></i></div></div>`); bind(UI.hud, { home: () => G.home() }); };
    hud(); KEYS = { Escape: () => G.home() };
    G.tick = () => { const now = performance.now(); left -= now - last; last = now; const t = $('#rt'); if (t) { t.firstChild.style.width = Math.max(0, Math.min(100, left / 750)) + '%'; t.classList.toggle('low', left < 10000); } if (left < 10000 && !fast) { fast = true; MUSIC.tempo(190); baoSay(SAY.fast[0], 'sad', 1800); } if (left <= 0 && !ended) { ended = true; cancelTyping(); finish(); } };
    const finish = () => { G.tick = null; MUSIC.tempo(156); MUSIC.play('title'); mission('rush'); const best = ST.best.rush || 0, isBest = score > best; if (isBest) { ST.best.rush = score; save(); }
      G.end(isBest ? '新紀錄！' : '收工！', isBest ? 'Sān géiluhk!' : 'Sāugūng!', isBest ? 'A new personal best!' : 'Rush hour is over.', ['Score ' + score, correct + ' / ' + answered + ' correct', 'Best ' + Math.max(best, score)], [['再嚟', 'Again', () => G.rush(), 'Enter'], ['主頁', 'Home', () => G.home(), 'Escape']]); };
    while (!ended && G.alive(run)) {
      let it; do { it = pick(pool); } while (pool.length > 1 && it === prev); prev = it;
      MAP.clearFx(); if (it.t === 'l') MAP.highlightLine(it.k.slice(2)); else if (isArea(it)) MAP.highlightArea(it.k); else MAP.pin(it);
      setSheet(`<div class="row" style="align-items:baseline;gap:12px"><span class="huge">${esc(it.hz)}</span><span class="en">${esc(it.en)}</span><span class="spacer"></span>${combo > 1 ? `<span class="ok big">×${combo}</span>` : ''}</div>${typebarHTML()}`);
      requestAnimationFrame(() => MAP.fitItem(it, { r: 40, dur: 350 })); showBao();
      const res = await askYale(it, { prompt: 'Correct = +2 s' }); if (ended || !G.alive(run)) return;
      answered++;
      if (res.scored) { correct++; combo++; const p = 5 + Math.min(combo, 8) * 2; score += p; addPoints(p); credit(it, 'y'); mission('type'); mission('combo', combo, true); left += 2000; sfx('coin', 1 + Math.min(combo, 8) * 0.06); toastMini('+' + p + ' · +2s'); const s = $('#rs'); if (s) s.textContent = score; }
      else { combo = 0; if (!res.hinted) debit(it, 'y'); }
      save();
    }
  },

  // ----- free roam -----
  roam(focus) {
    const run = G.enter('roam'); MUSIC.play('roam');
    MAP.setRules(it => stars(it) ? true : 'faint', it => stars(it) > 0); MAP.labelMinZ = 2.3;
    const start = focus || BY['S:TSY']; // always set out from home, Tsing Yi
    const tr = MAP.add.image(start.x, start.y, 'tour0').setOrigin(0.5, 1); tr.fixed = 2; MAP.fx.add(tr);
    const bang = MAP.add.text(0, 0, '!', { fontFamily: 'FP, FP2', fontSize: '24px', color: '#c8961e', stroke: '#fbf3dd', strokeThickness: 4 }).setOrigin(0.5, 1).setVisible(false); bang.fixed = 1; MAP.fx.add(bang);
    MAP.cam.setZoom(focus ? 4.5 : 3.2); MAP.followSprite(tr); setTimeout(() => G.alive(run) && MAP.followSprite(tr), 80); MAP.wheelOK = true; document.body.classList.add('roam');
    setHud(`<button class="iconbtn panel" data-a="home" title="Home (Esc)">${ic('home')}</button><div class="bar panel"><span class="big rmt">漫遊</span><span class="y rmt">Maahnyàuh</span><span class="t" id="rw"></span><span class="spacer"></span><button class="link y" id="rs" data-a="snk"></button><span class="y" id="rd"></span></div>`);
    bind(UI.hud, { home: () => G.home(), snk: () => openSnackBook() });
    if (touch) { // one round stick: press and slide your thumb; push to the rim to run
      show(UI.pad, `<div class="stick"><i class="knob"></i><b class="au">▲</b><b class="ad">▼</b><b class="al">◀</b><b class="ar">▶</b></div>`);
      const st = UI.pad.querySelector('.stick'), kn = st.querySelector('.knob');
      const upd = e => { const r = st.getBoundingClientRect(), R0 = r.width / 2; let x = (e.clientX - r.left - R0) / R0, y = (e.clientY - r.top - R0) / R0; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } PADV.x = m < 0.18 ? 0 : x; PADV.y = m < 0.18 ? 0 : y; PADV.m = Math.min(1, m); kn.style.transform = `translate(${x * R0 * 0.55}px,${y * R0 * 0.55}px)`; };
      const end = () => { PADV.x = PADV.y = PADV.m = 0; kn.style.transform = ''; st.classList.remove('on'); };
      st.addEventListener('pointerdown', e => { e.preventDefault(); st.setPointerCapture(e.pointerId); st.classList.add('on'); upd(e); });
      st.addEventListener('pointermove', e => { if (st.classList.contains('on')) upd(e); });
      st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end); }
    if (!touch) G.zoomButtons(70); // on phones: pinch
    const visitBtn = document.createElement('button'); visitBtn.id = 'visit'; visitBtn.className = 'btn gold'; visitBtn.hidden = true; UI.root.appendChild(visitBtn);
    const goBtn = document.createElement('button'); goBtn.id = 'travel'; goBtn.className = 'btn'; goBtn.hidden = true; UI.root.appendChild(goBtn); let goAct = null;
    goBtn.onclick = () => goAct && goAct();
    // getting about: hop on the MTR at any station you've met, or take a ferry from the piers
    const travel = (x, y, how) => { R.riding = true; goBtn.hidden = visitBtn.hidden = true; MAP.cam.fadeOut(320, 10, 12, 30); MAP.cam.once('camerafadeoutcomplete', () => { if (!G.alive(run)) return; tr.x = x; tr.y = y; tr.setVisible(true); MAP.followSprite(tr); MAP.cam.fadeIn(420, 10, 12, 30); R.riding = false; R.sea = seaAt(x, y); how && how(); }); };
    const mtrRide = (from, it) => { const legs = MAP.mtrRoute(from.k.slice(2), it.k.slice(2)); if (!legs || !legs.length) return mtrTo(it);
      const path = [], marks = []; let L = 0; legs.forEach((g, n) => { const pts = n ? g.pts.slice(1) : g.pts; if (!n || legs[n - 1].id !== g.id) marks.push({ L, id: g.id }); pts.forEach(p => { if (path.length) L += Math.hypot(p.x - path[path.length - 1].x, p.y - path[path.length - 1].y); path.push(p); }); });
      R.riding = true; goBtn.hidden = visitBtn.hidden = true; tr.setVisible(false); sfx('chime'); MUSIC.jingle('doors');
      const tex = id => MAP.miniTrain(LINES[id].color), train = MAP.add.image(path[0].x, path[0].y, tex(legs[0].id)); train.fixed = 2; MAP.fx.add(train); MAP.followSprite(train);
      const L0 = LINES[legs[0].id]; toast('搭' + L0.hz, 'Daap ' + L0.yale, 'To ' + it.en + (marks.length > 1 ? ' · ' + (marks.length - 1) + ' change' + (marks.length > 2 ? 's' : '') : ''), 2600);
      const o = { f: 0 }; let mk = 0;
      MAP.tweens.add({ targets: o, f: 1, duration: Phaser.Math.Clamp(L * 30, 2200, 12000), ease: 'Sine.easeInOut',
        onUpdate: () => { if (!G.alive(run)) return; const p = MAP.ptAt(path, o.f), q = MAP.ptAt(path, Math.min(1, o.f + 0.004)); train.setPosition(p.x, p.y); if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) MAP.aim(train, Math.atan2(q.y - p.y, q.x - p.x));
          while (mk + 1 < marks.length && o.f * L >= marks[mk + 1].L) { mk++; const Ln = LINES[marks[mk].id]; train.setTexture(tex(marks[mk].id)); sfx('ding'); MAP.pop(p.x, p.y, true, 8); toast('轉' + Ln.hz, 'Jyun ' + Ln.yale, 'Change to the ' + Ln.en, 2000); } },
        onComplete: () => { if (!G.alive(run)) return; train.destroy(); tr.x = it.x; tr.y = it.y + 2; tr.setVisible(true); MAP.followSprite(tr); R.riding = false; R.sea = seaAt(tr.x, tr.y); toast('下一站：' + it.hz, 'Hah yāt jaahm: ' + it.yale, it.en, 2600); setTimeout(() => G.alive(run) && say(it), 300); MAP.pop(it.x, it.y, true, 10); mission('ride'); } }); };
    const mtrTo = it => { sfx('chime'); travel(it.x, it.y + 2, () => { toast('下一站：' + it.hz, 'Hah yāt jaahm: ' + it.yale, it.en, 2600); setTimeout(() => G.alive(run) && say(it), 300); MAP.pop(it.x, it.y, true, 10); }); };
    const pickMtr = from => { const st = ITEMS.filter(i => i.t === 's' && stars(i) && i !== from).sort((a, b) => (a.lines || [''])[0].localeCompare((b.lines || [''])[0]) || a.yale.localeCompare(b.yale));
      if (!st.length) { toast('未識其他站', 'Meih sīk kèihtā jaahm', 'Meet more stations first — then you can ride between them.'); return; }
      openModal(`<div class="hd">${ic('map')}<h2>搭港鐵 <span class="y">Daap Góngtit</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div><p>From ${esc(from.hz)} ${esc(from.yale)}: where to? (stations you've met)</p><div class="snk">${st.map(i => `<button class="sn" data-k="${esc(i.k)}" style="text-align:left;cursor:pointer;border-left:4px solid ${(LINES[(i.lines || [])[0]] || {}).color || '#888'}"><b>${esc(i.hz)}</b><span class="y">${esc(i.yale)}</span></button>`).join('')}</div>`);
      bind($('#modal'), { x: () => closeModal(false) }); $('#modal').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { closeModal(false); mtrRide(from, BY[b.dataset.k]); }); };
    const ferryRide = (F, from) => { const path = from ? F.path.slice().reverse() : F.path, dest = F.ends[from ? 0 : 1], boat = MAP.add.image(path[0].x, path[0].y, F.tex).setOrigin(0.5, 0.8); boat.fixed = 2; MAP.fx.add(boat);
      R.riding = true; goBtn.hidden = visitBtn.hidden = true; tr.setVisible(false); sfx('horn'); toast('坐船去' + dest[0], 'Chóh syùhn heui ' + dest[1], 'Ferry to ' + dest[2] + ' — enjoy the view!', 2600);
      const L = path.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0), o = { f: 0 }; MAP.followSprite(boat);
      MAP.tweens.add({ targets: o, f: 1, duration: Phaser.Math.Clamp(L * 42, 2500, 14000), ease: 'Sine.easeInOut', onUpdate: () => { const p = MAP.ptAt(path, o.f), q = MAP.ptAt(path, Math.min(1, o.f + 0.01)); boat.setPosition(p.x, p.y).setFlipX(q.x < p.x); if (Math.random() < 0.08) MAP.ripEm.explode(1, p.x, p.y); },
        onComplete: () => { if (!G.alive(run)) return; boat.destroy(); sfx('horn'); tr.x = dest[3][0]; tr.y = dest[3][1] + 0.5; tr.setVisible(true); MAP.followSprite(tr); R.riding = false; R.sea = seaAt(tr.x, tr.y); toast('到咗' + dest[0], 'Doujó ' + dest[1], 'Welcome to ' + dest[2] + '!'); mission('ride'); } }); };
    const narrowWater = (ox, oy, x, y) => { const l = Math.hypot(x - ox, y - oy) || 1, ux = (x - ox) / l, uy = (y - oy) / l; let wet = false; for (let d = 0.25; d <= 6; d += 0.25) { const w = MAP.isWater(ox + ux * d, oy + uy * d); if (w) wet = true; else if (wet) return true; } return false; }; /* streams and nullahs: hop over; the sea: no */
    const landAhead = (ox, oy, x, y) => { const l = Math.hypot(x - ox, y - oy) || 1, ux = (x - ox) / l, uy = (y - oy) / l; for (let d = 0; d <= 5; d += 0.25) if (!MAP.isWater(x + ux * d, y + uy * d)) return true; return false; }; /* a step into water is fine only if dry land is within ~300 m straight ahead */
    const seaBlock = dt => { R.push = (R.push || 0) + dt; const now = performance.now(), n = Object.keys(ST.flags.rv || {}).length;
      if (now - (R.bt || 0) > 2200) { R.bt = now; sfx('bump'); MAP.ripEm.explode(2, tr.x, tr.y); toastMini('唔可以游水過海！'); }
      if (R.push > 900 && now - (R.ht ?? -1e9) > 20000) { R.ht = now; toast('唔可以游水過海！', 'M̀hóyíh yàuhséui gwo hói!', 'No swimming across the sea! Take the MTR, a ferry or a bridge. ' + (n >= 8 ? 'You\'ve walked enough districts — the fisherman 阿伯 in Aberdeen (香港仔) will lend you his junk.' : 'Walk ' + (8 - n) + ' more district' + (8 - n > 1 ? 's' : '') + ' and the fisherman 阿伯 in Aberdeen will lend you his junk.'), 6000); } };
    const pickFerry = pid => { const opts = []; for (const F of MAP.ferries) { if (F.a === pid) opts.push([F, 0]); else if (F.b === pid) opts.push([F, 1]); }
      if (opts.length === 1) return ferryRide(...opts[0]); const P = MAP.piers[pid];
      openModal(`<div class="hd">${ic('arrow-right')}<h2>坐船 <span class="y">Chóh syùhn</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div><p>${esc(P.hz)} ${esc(P.yale)} · ${esc(P.en)}: where to?</p><div class="snk">${opts.map(([F, e], n) => { const d = F.ends[e ? 0 : 1]; return `<button class="sn" data-n="${n}" style="text-align:left;cursor:pointer"><b>${esc(d[0])}</b><span class="y">${esc(d[1])}</span><small>${esc(d[2])}</small></button>`; }).join('')}</div>`);
      bind($('#modal'), { x: () => closeModal(false) }); $('#modal').querySelectorAll('[data-n]').forEach(b => b.onclick = () => { closeModal(false); ferryRide(...opts[+b.dataset.n]); }); };
    const R = { target: null, near: null, dist: undefined, step: 0, acc: 999, sea: false, riding: false }; let WORLD = null; try { WORLD = makeWorld(tr, run); } catch (e) { console.warn('world', e); }
    const visit = it => { const r = rec(it.k); say(it); showFact(it); sfx('blip'); if (!r.s) { meet(it); addPoints(3); mission('newn'); mission('disc'); save(); MAP.refresh(); sfx('sparkle'); toastMini('發現！ Faatyihn! +3'); burst(0.5, 0.45, 26); baoSay(['發現！', 'Faatyihn!', 'New discovery: ' + it.hz], 'happy'); } else save(); };
    visitBtn.onclick = () => { if (R.near) visit(R.near); };
    KEYS = { Escape: () => factIt ? hideFact() : G.home(), Enter: () => factIt ? hideFact() : R.near && visit(R.near), ' ': () => factIt ? hideFact() : R.near && visit(R.near), '+': () => MAP.zoomBy(1.3), '=': () => MAP.zoomBy(1.3), '-': () => MAP.zoomBy(0.77) };
    MAP.onTap = wp => { const n = nearestItem(wp.x, wp.y, 16 / MAP.cam.zoom); hideFact(); R.target = n ? { x: n.x, y: n.y, visit: n } : { x: wp.x, y: wp.y }; };
    if (touch) { if (!focus) setTimeout(() => G.alive(run) && toast('去邊度好？', 'Heui bīndouh hóu?', 'Drag the stick, or tap the map to walk there.', 3200), 400); } else showBao(); if (!touch) setTimeout(() => G.alive(run) && baoSay(focus ? ['到喇！', 'Dou la!', 'Here we are!'] : ['去邊度好？', 'Heui bīndouh hóu?', touch ? 'Tap the map to walk, or use the pad.' : 'Walk with the arrow keys or tap the map.'], 'happy', 3200), 500);
    if (focus) setTimeout(() => G.alive(run) && visit(focus), 700);
    G.tick = dt => {
      if (!tr.active) return; const z = MAP.cam.zoom; dt = Math.min(dt || 16, 50);
      const busy = $('#modal').style.display === 'flex' || R.riding;
      let dx = busy ? 0 : (KDOWN.ArrowLeft || KDOWN.a ? -1 : 0) + (KDOWN.ArrowRight || KDOWN.d ? 1 : 0) + PADV.x, dy = busy ? 0 : (KDOWN.ArrowUp || KDOWN.w ? -1 : 0) + (KDOWN.ArrowDown || KDOWN.s ? 1 : 0) + PADV.y;
      const sp = (touch ? 60 : 80) / z * (R.sea ? 1.6 : 1) * (KDOWN.Shift || PADV.m > 0.92 ? 2.4 : 1) * dt / 1000; let moved = false; // screen px per second, whatever the zoom
      const ox = tr.x, oy = tr.y;
      if (dx || dy) { R.target = null; const l = Math.max(1, Math.hypot(dx, dy)); tr.x += dx / l * sp; tr.y += dy / l * sp; if (dx) tr.setFlipX(dx > 0); moved = true; }
      else if (R.target && !R.riding) { const vx = R.target.x - tr.x, vy = R.target.y - tr.y, d = Math.hypot(vx, vy), st = Math.min(d, Math.max(sp * 2.2, d * dt / 900)); if (d <= st) { tr.x = R.target.x; tr.y = R.target.y; const v = R.target.visit; R.target = null; if (v) visit(v); } else { tr.x += vx / d * st; tr.y += vy / d * st; if (Math.abs(vx) > 0.5) tr.setFlipX(vx > 0); } moved = true; }
      tr.x = Phaser.Math.Clamp(tr.x, 20, DATA.W - 20); tr.y = Phaser.Math.Clamp(tr.y, 20, DATA.H - 20);
      if (moved && !ST.flags.junk && MAP.isWater(tr.x, tr.y) && !landAhead(ox, oy, tr.x, tr.y)) { tr.x = ox; tr.y = oy; R.target = null; moved = false; seaBlock(dt); } else if (moved) R.push = Math.max(0, (R.push || 0) - dt);
      if (!moved && R.sea) { R.step += dt; tr.setTexture(Math.floor(R.step / 600) % 2 ? 'junk1' : 'junk0'); }
      if (moved) { R.step += dt; const wasSea = R.sea; R.sea = seaAt(tr.x, tr.y); if (R.sea !== wasSea) { clearTimeout(R.mt); R.mt = setTimeout(() => G.alive(run) && MUSIC.play(R.sea ? 'sea' : 'roam'), 1200); } tr.setTexture(R.sea ? (Math.floor(R.step / 300) % 2 ? 'junk1' : 'junk0') : Math.floor(R.step / 150) % 2 ? 'tour1' : 'tour0'); if (factIt) hideFact(); MAP.followSprite(tr); }
      if (moved && (R.fx = (R.fx || 0) + dt) > (R.sea ? 420 : 210)) { R.fx = 0; if (R.sea) { MAP.ripEm.explode(1, tr.x, tr.y - 1); sfx('splash', 0.9 + Math.random() * 0.2); } else { MAP.dustEm.explode(2, tr.x, tr.y); if ((R.st = !R.st)) sfx('step', 0.8 + Math.random() * 0.4); } }
      if (WORLD) try { WORLD.tick(dt, moved, R.sea); } catch (e) { console.error('world tick', e); WORLD = null; } /* a bug in the extras must never freeze the walk */
      R.acc += dt; if (R.acc < 140) return; R.acc = 0;
      if (!R.riding) { let act = null, lbl = '';
        const stn = nearestItem(tr.x, tr.y, Math.max(5, 18 / z)); if (stn && stn.t === 's' && stars(stn)) { act = () => pickMtr(stn); lbl = `${ic('map')} <span class="lbl"><b style="font-size:12px">搭港鐵</b><small>Daap Góngtit</small></span>`; }
        const sd = act ? Math.hypot(stn.x - tr.x, stn.y - tr.y) : 1e9;
        for (const [pid, P] of Object.entries(MAP.piers || {})) { const pd = Math.hypot(P.land[0] - tr.x, P.land[1] + 0.5 - tr.y); if (pd < 6 && pd < sd && (!act || act.pier === undefined || pd < act.pier)) { const n = MAP.ferries.filter(F => F.a === pid || F.b === pid).length; act = () => pickFerry(pid); act.pier = pd; lbl = `${ic('arrow-right')} <span class="lbl"><b style="font-size:12px">坐船 · ${esc(P.hz)}碼頭</b><small>Ferry pier · ${n} route${n > 1 ? 's' : ''}</small></span>`; } }
        goAct = act; if (act) { if (goBtn.dataset.l !== lbl) { goBtn.innerHTML = lbl; goBtn.dataset.l = lbl; } goBtn.hidden = false; } else goBtn.hidden = true; }
      const n = nearestItem(tr.x, tr.y, Math.max(4, 16 / z));
      if (n !== R.near) { R.near = n; if (n) { bang.setVisible(true).setPosition(n.x, n.y - 6); sfx('pop'); visitBtn.innerHTML = `${ic('search')} <span class="lbl"><b style="font-size:12px">${stars(n) ? esc(n.hz) : '？？？'}</b><small>${touch ? 'tap to visit' : 'Enter to visit'}</small></span>`; visitBtn.hidden = false; } else { bang.setVisible(false); visitBtn.hidden = true; } }
      const d = districtAt(tr.x, tr.y);
      if (d !== R.dist) { R.dist = d; if (WORLD) WORLD.district(d); if (d) { banner(`<span class="big">歡迎嚟到 ${esc(d.hz)}</span><br><span style="color:#8a5400">Fūnyìhng làih dou ${esc(d.yale)}</span><br><span style="color:#6b665b">${esc(d.en)}</span>`, 'paper'); if (meet(d)) { addPoints(3); mission('newn'); save(); } } const w = $('#rw'); if (w) w.textContent = d ? d.hz + ' ' + d.yale : ''; }
      if (moved) ST.roamAt = [Math.round(tr.x), Math.round(tr.y)];
      const rd = $('#rd'); if (rd) rd.textContent = '見過 ' + ITEMS.filter(i => stars(i)).length + '/' + ITEMS.length;
    };
  },
  explore(it) { G.roam(it); },
};
// ---------- the open world of free roam: neighbours, Pòhpó's cat, street snacks ----------
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GREET = [['早晨！', 'Jóusàhn!', 'Good morning!'], ['食咗飯未呀？', 'Sihkjó faahn meih a?', 'Eaten yet? (= how are you)'], ['呢排點呀？', 'Nīpàaih dím a?', 'How have you been lately?'], ['去邊呀？', 'Heui bīn a?', 'Where are you off to?'],
  ['好耐冇見！', 'Hóu noih móuh gin!', 'Long time no see!'], ['搵日一齊食飯吖！', 'Wányaht yātchàih sihkfaahn ā!', "Let's have a meal together some day!"], ['今日好熱呀！', 'Gāmyaht hóu yiht a!', "It's so hot today!"], ['你識講廣東話㗎？好叻呀！', 'Néih sīk góng Gwóngdūngwá ga? Hóu lek a!', 'You speak Cantonese? Impressive!'],
  ['飲咗茶未呀？', 'Yámjó chàh meih a?', 'Had your yum cha yet?'], ['慢慢行呀！', 'Maahnmáan hàahng a!', 'Take care! (lit. walk slowly)'], ['忙到死呀！', 'Mòhng dou séi a!', "I'm so busy!"], ['嘛嘛哋啦！', 'Màhmádéi lā!', 'So-so!'], ['冇嘢做呀，好得閒！', 'Móuh yéh jouh a, hóu dākhàahn!', 'Nothing to do, so free!'], ['遲啲見！', 'Chìhdī gin!', 'See you later!']];
const SNACKS = [['蛋撻', 'daahntāat', 'egg tart', 0], ['菠蘿包', 'bōlòhbāau', 'pineapple bun', 1], ['魚蛋', 'yùhdáan', 'curry fish balls', 3], ['雞蛋仔', 'gāidáanjái', 'egg waffle', 1], ['燒賣', 'sīumáai', 'siu mai', 3], ['碗仔翅', 'wúnjáichi', 'imitation shark fin soup', 2],
  ['奶茶', 'náaihchàh', 'milk tea', 4], ['叉燒包', 'chāsīubāau', 'BBQ pork bun', 1], ['腸粉', 'chéungfán', 'rice noodle roll', 2], ['格仔餅', 'gaakjáibéng', 'grid waffle', 0], ['牛雜', 'ngàuhjaahp', 'beef offal', 3], ['臭豆腐', 'chaudauhfuh', 'stinky tofu', 3],
  ['楊枝甘露', 'yèuhngjī gāmlouh', 'mango pomelo sago', 5], ['西多士', 'sāidōsí', 'HK French toast', 0], ['鴛鴦', 'yūnyēung', 'coffee + milk tea', 4], ['檸檬茶', 'nìhngmūngchàh', 'lemon tea', 4], ['菠蘿油', 'bōlòhyàuh', 'pineapple bun with butter', 1], ['雪糕', 'syutgōu', 'ice cream (from the Mister Softee van)', 5],
  ['缽仔糕', 'butjáigōu', 'bowl pudding', 5], ['豆腐花', 'dauhfuhfā', 'tofu pudding', 2], ['車仔麵', 'chējáimihn', 'cart noodles', 2], ['雲吞麵', 'wàhntānmihn', 'wonton noodles', 2], ['糖水', 'tòhngséui', 'sweet soup', 2], ['涼茶', 'lèuhngchàh', 'herbal tea', 4]];
const POPO_V = VOICES[2], POPO = { ask: '有冇見過我隻貓呀？', thanks: '多謝晒！你真係好人！', again: '多謝晒你呀！' };
const AUG = [['Bonjour！我係Augustin！', 'Bonjour! Ngóh haih Augustin!', "Bonjour! I'm Augustin!"], ['我鍾意喺樹屋度彈結他！', 'Ngóh jūngyi hái syuhūk douh tàahn gittā!', 'I love playing guitar up in my tree house!'], ['南丫島好靚呀！', "Nàahm'ā Dóu hóu leng a!", 'Lamma is so beautiful!'], ['一齊唱歌啦！', 'Yātchàih cheunggō lā!', "Let's sing together!"], ['慢慢嚟，唔使急！', 'Maahnmáan làih, m̀sái gāp!', 'Take it easy, no rush!']];
const ABAAK = { wait: ['想出海？行多幾個地方先啦！', 'Séung chēut hói? Hàahng dō géi go deihfong sīn lā!', 'Want to go to sea? Walk a few more districts first!'], give: ['你行咗咁多地方，隻帆船借俾你！', 'Néih hàahngjó gam dō deihfong, jek fàahnsyùhn je béi néih!', "You've walked so many places — I'll lend you my junk!"], bye: ['一路順風！', 'Yātlouh seuhnfūng!', 'Bon voyage! (lit. a fair wind all the way)'] };
const FOLK = [ // [key, lon, lat, textures, voice, sfx, lines]
  ['bird', 114.1725, 22.3250, ['birdpa'], 1, 'chirp', [['隻雀仔好靚㗎！', 'Jek jeukjái hóu leng ga!', 'My little bird is so pretty! (Yuen Po Street Bird Garden)'], ['聽吓佢唱歌！', 'Tēng háh kéuih cheunggō!', 'Listen to it sing!']]],
  ['taichi', 114.1880, 22.2815, ['taichi0', 'taichi1'], 0, 'chime', [['早晨！一齊打太極啦！', 'Jóusàhn! Yātchàih dá taaigihk lā!', 'Morning! Come do tai chi with us!'], ['慢慢嚟，深呼吸。', 'Maahnmáan làih, sām fūkāp.', 'Slowly now — deep breaths.']]],
  ['mj', 114.1610, 22.3305, ['mjt'], 2, 'clack', [['食糊！', 'Sihkwùh!', 'Mahjong — I win!'], ['一齊打麻雀吖！', 'Yātchàih dá màhjeuk ā!', 'Come play mahjong with us!']]]];
const SOFTEE = [['雪糕車嚟喇！', 'Syutgōuchē làih la!', 'The ice-cream van is here!'], ['要唔要雪糕呀？', 'Yiu m̀yiu syutgōu a?', 'Want some ice cream?']];
const seaAt = (x, y) => MAP.isWater(x, y) && !!ST.flags.junk; // without the junk you walk; water underfoot is just a stream or a channel you're hopping
const greetVoice = ph => VOICES[GREET.indexOf(ph) % 3];
const allLines = () => [...GREET.map(g => [g[0], greetVoice(g)]), ...Object.values(POPO).map(h => [h, POPO_V]), ...SNACKS.map(s => [s[0], VOICES[0]]), ...AUG.map(l => [l[0], VOICES[1]]), ...Object.values(ABAAK).map(l => [l[0], VOICES[1]]), ...FOLK.flatMap(f => f[6].map(l => [l[0], VOICES[f[4]]])), ...SOFTEE.map(l => [l[0], VOICES[1]])];
let SNACK_AT = null; // where each snack hides: fixed for everyone, spread across town
function snackSpots() {
  if (SNACK_AT) return SNACK_AT; const R = seeded(852), out = [];
  for (let k = 0; k < 40000 && out.length < SNACKS.length; k++) { const x = 40 + R() * (DATA.W - 80), y = 40 + R() * (DATA.H - 80); if (MAP.isWater(x, y) || !districtAt(x, y) || !(MAP.isUrban(x, y) || R() < 0.15)) continue; if (out.some(o => Math.hypot(o.x - x, o.y - y) < 48)) continue; out.push({ x, y }); }
  return SNACK_AT = out;
}
function landNear(R, x, y, r, urban = true) { for (let k = 0; k < 300; k++) { const a = R() * 6.283, d = R() * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!MAP.isWater(px, py) && (!urban || MAP.isUrban(px, py) || k > 200)) return { x: px, y: py }; } return { x, y }; }
function openSnackBook() {
  const got = ST.flags.snk || {}, rv = ST.flags.rv || {}, n = SNACKS.filter(s => got[s[0]]).length, SP = snackSpots();
  openModal(`<div class="hd">${ic('coffee')}<h2>小食 <span class="y">Síusihk</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div>
  <p>Street snacks hidden around Hong Kong: <b>${n} / ${SNACKS.length}</b> found · districts walked: <b>${Object.keys(rv).length} / ${DISTS.length}</b>. Walk over a sparkle in free roam to pick one up.</p>
  <div class="snk">${SNACKS.map((s, i) => got[s[0]] ? `<div class="sn"><b>${esc(s[0])}</b><span class="y">${esc(s[1])}</span><small>${esc(s[2])}</small></div>` : `<div class="sn no"><b>？？</b><small>somewhere in ${(d => d ? esc(d.hz) + ' ' + esc(d.yale) : 'Hong Kong')(SP[i] && districtAt(SP[i].x, SP[i].y))}</small></div>`).join('')}</div>`);
  bind($('#modal'), { x: () => closeModal(G.mode !== 'roam') });
}
function makeWorld(tr, run) {
  const F = ST.flags, day = today(), R = seeded(hashStr('npc')), people = [], WB = {};
  F.snk = F.snk || {}; F.rv = F.rv || {};
  const bubble = (o, ph, ms = 3600) => { if (o.bub) o.bub.destroy(); const t = MAP.add.text(o.s.x, o.s.y - o.s.displayHeight - 0.5, ph[0] + '\n' + ph[1], { fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: '12px', color: '#1d2340', backgroundColor: '#fbf3dd', padding: { x: 5, y: 3 }, align: 'center', resolution: 3 }).setOrigin(0.5, 1); t.fixed = 1.2; MAP.fx.add(t); o.bub = t; o.bubT = ms; };
  // neighbours: a couple in every district, a few more around home in Tsing Yi
  for (const d of DISTS) { const g = GEO[d.k]; if (!g || !g.poly) continue; const xs = g.poly.map(p => p[0]), ys = g.poly.map(p => p[1]);
    for (let n = 0, k = 0; n < 2 && k < 400; k++) { const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + R() * (Math.max(...ys) - Math.min(...ys)); if (MAP.isWater(x, y) || districtAt(x, y) !== d || (!MAP.isUrban(x, y) && k < 300)) continue; people.push({ x, y }); n++; } }
  const home = BY['S:TSY']; for (let n = 0; n < 3; n++) people.push(landNear(R, home.x, home.y, 40));
  const npcs = people.map((p, i) => { const s = MAP.add.image(p.x, p.y, 'npc' + (i % 5)).setOrigin(0.5, 1); s.fixed = 2.0; MAP.fx.add(s); return { s, hx: p.x, hy: p.y, tx: p.x, ty: p.y, wait: R() * 4000, ph: GREET[i % GREET.length], last: -1e9 }; });
  // Pòhpó and her cat (a new hiding place every day)
  const pp = landNear(seeded(7), home.x + 8, home.y + 6, 10), popo = { s: MAP.add.image(pp.x, pp.y, 'popo').setOrigin(0.5, 1), last: -1e9 }; popo.s.fixed = 2.0; MAP.fx.add(popo.s);
  if (!F.cat || F.cat.day !== day) { const r2 = seeded(hashStr(day + 'cat')), far = DISTS.filter(d => d.k !== (districtAt(home.x, home.y) || {}).k), d = far[Math.floor(r2() * far.length)], c = BY[d.k] || d; F.cat = { day, d: d.k, done: false, ...landNear(r2, c.x, c.y, 30) }; }
  const catD = BY[F.cat.d] || DISTS.find(d => d.k === F.cat.d) || { hz: '', yale: '', en: '' };
  const cat = { s: MAP.add.image(F.cat.x, F.cat.y, 'cat').setOrigin(0.5, 1), follow: false }; cat.s.fixed = 2; MAP.fx.add(cat.s); cat.s.setVisible(!F.cat.done);
  // snacks still to find
  const spots = snackSpots(), snacks = SNACKS.map((sn, i) => ({ sn, p: spots[i] })).filter(o => o.p && !F.snk[o.sn[0]]).map(o => { const s = MAP.add.image(o.p.x, o.p.y, 'snk' + o.sn[3]).setOrigin(0.5, 1); s.fixed = 2.0; MAP.fx.add(s); return Object.assign(o, { s }); });
  const WPt = (lo, la) => ({ x: (lo - 113.80) * 1850 * Math.cos(22.35 * Math.PI / 180), y: (22.58 - la) * 1850 }), put = (tex, p) => { const s = MAP.add.image(p.x, p.y, tex).setOrigin(0.5, 1); s.fixed = 2; MAP.fx.add(s); return s; };
  const fade = o => { const d = Math.hypot(o.s.x - tr.x, o.s.y - tr.y), a = Phaser.Math.Clamp((90 - d) / 20, 0, 1); o.s.setAlpha(a).setVisible(a > 0); return d; };
  const talk = (o, ph, voice, ms) => { bubble(o, ph, ms); sayLine(ph[0], voice); if (!o.met) { o.met = true; addPoints(2); mission('greet'); } };
  // Augustin, jamming in his tree house on the hill above Yung Shue Wan
  const ap = landNear(seeded(33), ...Object.values(WPt(114.1180, 22.2230)), 2, false), tree = { s: put('thouse', ap) }, aug = { s: put('aug0', ap), last: -1e9, n: 0, nt: 0 }; tree.s.fixed = 3.2; /* a building, not a person: drawn a bit bigger */
  // the fisherman 阿伯 on the Aberdeen waterfront, who lends his junk to seasoned walkers
  const abaak = { s: put('abaak', landNear(seeded(44), ...Object.values(WPt(114.1545, 22.2490)), 5, false)), last: -1e9 };
  const folk = FOLK.map(([k, lo, la, tx, v, fx, lines]) => { const p = landNear(seeded(hashStr(k)), ...Object.values(WPt(lo, la)), 4, false), o = { k, tx, v, fx, lines, n: 0, last: -1e9, s: put(tx[0], p), x: p.x, y: p.y };
    if (k === 'taichi') o.more = [put(tx[1], p), put(tx[0], p)]; return o; });
  // Mister Softee, crawling up and down Nathan Road with his jingle
  const vp = [[114.1722, 22.2962], [114.1718, 22.3000], [114.1712, 22.3040], [114.1702, 22.3085]].map(p => WPt(...p)), van = { s: put('softee', vp[0]), path: vp, f: 0, dir: 1, last: -1e9, jt: -1e9, n: 0 };
  const hud = () => { const e = $('#rs'); if (e) e.innerHTML = `${ic('coffee')} ${SNACKS.filter(s => F.snk[s[0]]).length}/${SNACKS.length}`; };
  setTimeout(hud, 0);
  const grab = i => { const o = snacks[i]; F.snk[o.sn[0]] = day; MAP.pop(o.s.x, o.s.y - 2, true, 18); o.s.destroy(); snacks.splice(i, 1); sfx('coin'); setTimeout(() => sayLine(o.sn[0], VOICES[0]), 350); addPoints(5); mission('snack'); const n = SNACKS.filter(s => F.snk[s[0]]).length; toast(o.sn[0] + ' +5', o.sn[1], o.sn[2] + ' · 小食 ' + n + '/' + SNACKS.length); hud(); save(); };
  let t = 0;
  return {
    tick(dt, moved, sea) { t += dt; const z = MAP.cam.zoom, near = (o, r) => Math.hypot(o.s.x - tr.x, o.s.y - tr.y) < r;
      for (const o of npcs) { // amble about a little, stay on land, say hello when you pass
        { const d = Math.hypot(o.s.x - tr.x, o.s.y - tr.y), a = Phaser.Math.Clamp((75 - d) / 20, 0, 1); o.s.setAlpha(a).setVisible(a > 0); if (!a) continue; } /* neighbours appear as you approach: less clutter, more discovery */
        if ((o.wait -= dt) <= 0) { const p = landNear(R, o.hx, o.hy, 6); o.tx = p.x; o.ty = p.y; o.wait = 2500 + R() * 5000; }
        const vx = o.tx - o.s.x, vy = o.ty - o.s.y, d = Math.hypot(vx, vy); if (d > 0.2) { o.s.x += vx / d * Math.min(d, 2.2 * dt / 1000); o.s.y += vy / d * Math.min(d, 2.2 * dt / 1000); o.s.setFlipX(vx > 0); o.s.y += Math.sin(t / 90) * 0.02; }
        if (!sea && near(o, 8) && t - o.last > 25000 && t - (WB.t || -1e9) > 3500) { o.last = t; WB.t = t; for (const q of npcs) if (q.bub && q !== o) { q.bub.destroy(); q.bub = null; } bubble(o, o.ph); sayLine(o.ph[0], greetVoice(o.ph)); if (!o.greeted) { o.greeted = true; addPoints(1); mission('greet'); } }
        if (o.bub) { o.bub.setPosition(o.s.x, o.s.y - o.s.displayHeight - 0.5); if ((o.bubT -= dt) <= 0) { o.bub.destroy(); o.bub = null; } } }
      // Pòhpó
      if (!sea && near(popo, 9) && t - popo.last > 9000) { popo.last = t;
        if (F.cat.done) { bubble(popo, [POPO.again, 'Dōjeh saai néih a!', 'Thank you so much!']); sayLine(POPO.again, POPO_V); }
        else if (cat.follow) { F.cat.done = true; cat.follow = false; cat.s.setVisible(false); bubble(popo, [POPO.thanks, 'Dōjeh saai! Néih jānhaih hóu yàhn!', 'Thank you! What a kind person!'], 4500); sayLine(POPO.thanks, POPO_V); sfx('sparkle'); burst(0.5, 0.45, 50); addPoints(20); mission('cat'); toast('搵返隻貓！ +20', 'Wánfāan jek māau!', "Pòhpó's cat is home safe."); save(); }
        else { bubble(popo, [POPO.ask, 'Yáuh móuh gingwo ngóh jek māau a?', ''], 5000); sayLine(POPO.ask, POPO_V); setTimeout(() => G.alive(run) && toast('婆婆 Pòhpó', '佢去咗' + catD.hz + ' · Kéuih heuijó ' + catD.yale, 'Her orange cat wandered off to ' + catD.en + '. Find it and walk it home!', 4200), 900); } }
      if (popo.bub) { popo.bub.setPosition(popo.s.x, popo.s.y - popo.s.displayHeight - 0.5); if ((popo.bubT -= dt) <= 0) { popo.bub.destroy(); popo.bub = null; } }
      // the cat: found → follows you home
      if (!F.cat.done) { if (!cat.follow && !sea && near(cat, 7)) { cat.follow = true; sfx('meow'); MAP.pop(cat.s.x, cat.s.y - 2, true, 10); toast('喵～', 'Mīu~', 'You found the cat! Walk it back to Pòhpó in Tsing Yi.'); }
        if (cat.follow) { const bx = tr.x + (tr.flipX ? -5 : 5), by = tr.y + 1; cat.s.x += (bx - cat.s.x) * Math.min(1, dt / 220); cat.s.y += (by - cat.s.y) * Math.min(1, dt / 220); cat.s.setFlipX(!tr.flipX); cat.s.setVisible(!sea); } else cat.s.y = F.cat.y + (Math.floor(t / 700) % 2 ? -0.2 : 0); }
      const sW = 2 / z;
      // Augustin: strums when you're near, music notes drift up, and his swing tune takes over the music
      { const d = fade(tree); aug.s.setAlpha(tree.s.alpha).setVisible(tree.s.visible).setPosition(tree.s.x - 6.4 * sW, tree.s.y - 9.6 * sW);
        if (d < 70) { if ((aug.nt += dt) > 230) { aug.nt = 0; aug.s.setTexture(aug.s.texture.key === 'aug0' ? 'aug1' : 'aug0'); if (Math.random() < 0.35) { const n = MAP.add.text(aug.s.x + (Math.random() * 6 - 3) * sW, aug.s.y - 12 * sW, Math.random() < 0.5 ? '♪' : '♫', { fontFamily: 'serif', fontSize: '14px', color: '#5a3a8a', resolution: 3 }).setOrigin(0.5); n.fixed = 1; MAP.fx.add(n); MAP.tweens.add({ targets: n, y: n.y - 14 * sW, x: n.x + (Math.random() - 0.5) * 8 * sW, alpha: 0, duration: 1600, onComplete: () => n.destroy() }); } } }
        if (d < 32 && !WB.lamma) { WB.lamma = true; MUSIC.play('lamma'); } else if (d > 48 && WB.lamma) { WB.lamma = false; MUSIC.play(sea ? 'sea' : 'roam'); }
        if (!sea && d < 10 && t - aug.last > 14000) { aug.last = t; const first = !aug.met; talk(aug, AUG[aug.n++ % AUG.length], VOICES[1], 4200); if (first) { addPoints(8); sfx('sparkle'); setTimeout(() => G.alive(run) && toast('識咗新朋友！', 'Sīkjó sān pàhngyáuh!', 'Augustin, a French guitarist, jams in his tree house on Lamma.', 4200), 1200); } }
        if (aug.bub) { aug.bub.setPosition(aug.s.x, aug.s.y - aug.s.displayHeight - 0.5); if ((aug.bubT -= dt) <= 0) { aug.bub.destroy(); aug.bub = null; } } }
      // 阿伯 and his junk
      { const d = fade(abaak); if (!sea && d < 9 && t - abaak.last > 9000) { abaak.last = t; const n = Object.keys(F.rv).length;
          if (F.junk) talk(abaak, ABAAK.bye, VOICES[1]);
          else if (n >= 8) { F.junk = day; talk(abaak, ABAAK.give, VOICES[1], 5000); sfx('sparkle'); burst(0.5, 0.45, 50); addPoints(20); save(); setTimeout(() => G.alive(run) && toast('解鎖帆船！ +20', 'Gáaisó fàahnsyùhn!', 'You can sail across the sea now — just walk into the water.', 5000), 1400); }
          else { talk(abaak, [ABAAK.wait[0], ABAAK.wait[1], ABAAK.wait[2] + ' (' + n + '/8 districts)'], VOICES[1], 4600); } }
        if (abaak.bub) { abaak.bub.setPosition(abaak.s.x, abaak.s.y - abaak.s.displayHeight - 0.5); if ((abaak.bubT -= dt) <= 0) { abaak.bub.destroy(); abaak.bub = null; } } }
      // the regulars: bird-garden grandpa, the tai chi aunties, a mahjong table
      for (const o of folk) { const d = fade(o);
        if (o.more) { const ph = Math.floor(t / 1600) % 2; o.more.forEach((m, k) => m.setPosition(o.x + (k ? 7 : -7) * sW, o.y).setAlpha(o.s.alpha).setVisible(o.s.visible).setTexture(o.tx[(ph + k + 1) % 2]).setFlipX(k === 0)); o.s.setTexture(o.tx[ph]); }
        if (o.k === 'bird' && d < 40 && Math.random() < dt / 2600) sfx('chirp', 0.8 + Math.random() * 0.4);
        if (o.k === 'mj' && d < 40 && Math.random() < dt / 1800) sfx('clack', 0.9 + Math.random() * 0.3);
        if (!sea && d < 9 && t - o.last > 16000) { o.last = t; sfx(o.fx); talk(o, o.lines[o.n++ % o.lines.length], VOICES[o.v]); }
        if (o.bub) { o.bub.setPosition(o.s.x, o.s.y - o.s.displayHeight - 0.5); if ((o.bubT -= dt) <= 0) { o.bub.destroy(); o.bub = null; } } }
      // Mister Softee: drives, stops, plays the jingle when you're close; the first visit gets you a 雪糕
      { van.f += van.dir * dt / 26000; if (van.f > 1 || van.f < 0) { van.dir *= -1; van.f = Phaser.Math.Clamp(van.f, 0, 1); } const p = MAP.ptAt(van.path, van.f), q = MAP.ptAt(van.path, Phaser.Math.Clamp(van.f + van.dir * 0.01, 0, 1)); van.s.setPosition(p.x, p.y).setFlipX(q.x > p.x); const d = fade(van);
        if (d < 30 && t - van.jt > 14000) { van.jt = t; MUSIC.jingle('softee'); }
        if (!sea && d < 9 && t - van.last > 15000) { van.last = t; talk(van, SOFTEE[van.n++ % SOFTEE.length], VOICES[1]); const i = snacks.findIndex(o => o.sn[0] === '雪糕'); if (i >= 0) setTimeout(() => G.alive(run) && snacks[i] && snacks[i].sn[0] === '雪糕' && grab(i), 1500); }
        if (van.bub) { van.bub.setPosition(van.s.x, van.s.y - van.s.displayHeight - 0.5); if ((van.bubT -= dt) <= 0) { van.bub.destroy(); van.bub = null; } } }
      // snacks: bob and twinkle; walk over one to pick it up
      if ((WB.tw = (WB.tw || 0) + dt) > 260 && snacks.length) { WB.tw = 0; const v = MAP.cam.worldView, vis = snacks.filter(o => v.contains(o.s.x, o.s.y)); if (vis.length) { const o = vis[(Math.random() * vis.length) | 0]; MAP.burstEm.ops.scaleX.start = MAP.burstEm.ops.scaleY.start = 1.2 / z; MAP.burstEm.explode(1, o.s.x + (Math.random() - 0.5) * 4, o.s.y - 3); } }
      for (let i = snacks.length - 1; i >= 0; i--) { const o = snacks[i]; o.s.y = o.p.y - 1 - Math.abs(Math.sin(t / 380 + i)) * 1.5; o.s.setAlpha(z > 1.6 ? Phaser.Math.Clamp((110 - Math.hypot(o.s.x - tr.x, o.s.y - tr.y)) / 25, 0, 1) : 0);
        if (!sea && near(o, 6)) grab(i); }
    },
    district(d) { if (d && !F.rv[d.k]) { F.rv[d.k] = day; save(); } },
  };
}
function nearestItem(x, y, rad) { let best = null, bd = rad; for (const o of ITEMS) { if (o.t === 'l' || isArea(o)) continue; const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } } return best; }
function toastMini(s) { const t = document.createElement('div'); t.className = 'toast'; t.style.padding = '4px 12px'; t.innerHTML = `<i>${esc(s)}</i>`; UI.toasts.appendChild(t); setTimeout(() => t.remove(), 1300); }
const KDOWN = {}, PADV = { x: 0, y: 0, m: 0 };
window.addEventListener('keydown', e => {
  if (MGrun && (e.key === 'Escape' || !(document.activeElement && document.activeElement.tagName === 'INPUT'))) { if (MGrun.key(e)) { e.preventDefault(); return; } }
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (typing || $('#modal').style.display === 'flex') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KDOWN[k === 'shift' ? 'Shift' : k] = true; if (e.key === 'Shift') KDOWN.Shift = true;
  if (k === 'm' && G.mode !== 'boot') { MUSIC.toggle(); toastMini(ST.settings.music ? '♪ Music on' : '♪ Music off'); return; }
  if (KEYS[k] || KEYS[e.key]) { e.preventDefault(); (KEYS[k] || KEYS[e.key])(); }
  else if (/^Arrow/.test(e.key) && G.mode === 'roam') e.preventDefault();
});
window.addEventListener('keyup', e => { if (MGrun && /^Arrow|^[ad]$/.test(e.key)) MGrun.key(e); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; KDOWN[k] = false; if (e.key === 'Shift') KDOWN.Shift = false; });
window.addEventListener('blur', () => { for (const k in KDOWN) KDOWN[k] = false; });

// ---------- collection 圖鑑 ----------
const MODAL = $('#modal'), BOX = $('#modal-box');
const modalOpen = () => MODAL.style.display === 'flex';
function openModal(html, wide) { BOX.className = 'box panel' + (wide ? ' wide' : ''); BOX.innerHTML = html; MODAL.style.display = 'flex'; }
function closeModal(home = true) { MODAL.style.display = 'none'; hideFact(); if (home) G.home(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen()) { e.stopPropagation(); if (factIt) hideFact(); else closeModal(); } }, true);
let colTab = 'all';
function openCollection(tab) {
  if (tab) colTab = tab; cancelTyping();
  const groups = [['all', '全部 All'], ['area', '地區 Districts'], ['mtr', '港鐵 MTR'], ['place', '景點 Sights'], ['church', '教堂 Churches']];
  const inTab = it => colTab === 'all' || (colTab === 'area' ? isArea(it) : colTab === 'mtr' ? (it.t === 's' || it.t === 'l') : colTab === 'place' ? it.t === 'p' : it.t === 'c');
  const list = ITEMS.filter(inTab), metN = ITEMS.filter(i => stars(i)).length, mN = ITEMS.filter(i => mastered(i)).length;
  openModal(`<div class="hd">${ic('book-open')}<h2>圖鑑 <span class="y">Tòuhgaam</span></h2><span class="en">met ${metN}/${ITEMS.length} · 識 ${mN}</span><button class="iconbtn" data-a="x">${ic('close')}</button></div>
    <p>Tap a card for its story and sound. ${ic('map-pin')} walks you there in free roam. Mastered names get a 識 <span class="y">sīk</span> ("know") stamp.</p>
    <div class="tabs">${groups.map(([id, l]) => `<button class="btn ${id === colTab ? 'on' : ''}" data-tab="${id}">${esc(l)}</button>`).join('')}</div><div class="cgrid" id="cg"></div>`, true);
  const grid = $('#cg');
  for (const it of list) {
    const s = stars(it), met = s > 0, col = it.t === 's' ? LINES[it.lines[0]].color : typeColor(it), u = photoUrl(it);
    const d = document.createElement('div'); d.className = 'card' + (met ? '' : ' locked');
    d.innerHTML = `<div class="lb" style="background:${col}"></div>${u ? `<img loading="lazy" alt="" src="${esc(u)}">` : '<img alt="">'}<div class="hz">${met ? esc(it.hz) : '？？？'}</div><div class="yl">${met ? esc(it.yale) : ''}</div><div class="en">${met ? esc(it.en) : TYPE[it.t]}</div><div class="stars">${starStr(s)}</div>${mastered(it) ? '<div class="sx">識</div>' : ''}${met && it.t !== 'l' && !isArea(it) ? `<div class="go" title="Walk there">${ic('map-pin')}</div>` : ''}`;
    if (met) d.onclick = ev => { if (ev.target.closest('.go')) { closeModal(false); G.roam(it); } else { say(it); sfx('blip'); openFactModal(it); } };
    grid.appendChild(d);
  }
  BOX.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => openCollection(b.dataset.tab));
  bind(BOX, { x: () => closeModal() });
}
function openFactModal(it) {
  const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;background:rgba(11,15,34,.6);padding:16px';
  ov.innerHTML = `<div class="paper fcard" style="width:min(380px,100%);max-height:100%;overflow:auto;padding:12px" id="fm">${factHTML(it)}</div>`;
  document.body.appendChild(ov); factIt = it; const close = () => { ov.remove(); factIt = null; };
  ov.onclick = e => { if (e.target === ov) close(); }; bind(ov, { say: () => say(it), x: close });
  const esc_ = e => { if (e.key === 'Escape') { close(); e.stopPropagation(); document.removeEventListener('keydown', esc_, true); } }; document.addEventListener('keydown', esc_, true);
  
}

// ---------- settings ----------
let resetArmed = false;
function openSettings() {
  const s = ST.settings, ready = ANKI ? ankiReady() : [];
  openModal(`<div class="hd">${ic('settings-cog')}<h2>設定 <span class="y">Chitdihng</span></h2><button class="iconbtn" data-a="x">${ic('close')}</button></div>
  <h3>${ic('music')} Music & sound</h3>
  <div class="rowb"><button class="btn sm ${s.music ? 'gold' : ''}" data-a="music">♪ Music ${s.music ? 'on' : 'off'}</button><button class="btn sm ${s.sfx ? 'gold' : ''}" data-a="sfx">Sound effects ${s.sfx ? 'on' : 'off'}</button><button class="btn sm ${s.tones ? 'gold' : ''}" data-a="tones">Tone keys ${s.tones ? 'on' : 'off'}</button></div>
  <p>Tone keys add ā á a àh áh ah buttons under the answer box (handy on phones). On a keyboard you can also type tone numbers: <span class="y">yau4 → yàuh</span>, <span class="y">sik1 → sīk</span>.</p>
  <h3>${ic('volume-3')} Voice</h3>
  <p>Names are spoken from recordings that ship with the game, or by your device's Cantonese voice. Optional: paste your own Azure Speech key for natural voices on every name — it stays in this browser only.</p>
  <label>Azure key (optional)</label><input id="m-key" type="password" value="${esc(s.key || '')}" placeholder="your Azure Speech key" autocomplete="off">
  <label>Region</label><input id="m-region" value="${esc(s.region || '')}" placeholder="eastasia">
  <label>Voice</label><select id="m-voice">${[['zh-HK-HiuMaanNeural', 'HiuMaan · female'], ['zh-HK-HiuGaaiNeural', 'HiuGaai · female'], ['zh-HK-WanLungNeural', 'WanLung · male']].map(([v, l]) => `<option value="${v}" ${v === s.voice ? 'selected' : ''}>${l}</option>`).join('')}</select>
  <div class="rowb"><button class="btn sm" data-a="test">試聽 Test</button><button class="btn sm" data-a="all">Make the missing sound files</button></div><div class="stt" id="m-audio"></div>
  <h3>${ic('download')} Your progress</h3>
  <p>Progress is saved in this browser. To move it to another device (or keep a backup), save it to a file and load it there.</p>
  <div class="rowb"><button class="btn sm" data-a="exp">${ic('download')} Save progress file</button><label class="btn sm" style="margin:0">${ic('upload')} Load progress file<input type="file" id="m-imp" accept=".json,application/json" hidden></label></div><div class="stt" id="m-prog"></div>
  ${ANKI ? `<h3>${ic('reload')} Sync my devices (private)</h3>
  ${SYNC.on() ? `<p>This browser shares progress with your other devices through a secret GitHub gist. It syncs on its own when you play, open or leave the game.</p>
  <div class="rowb"><button class="btn sm gold" data-a="syncnow">${ic('reload')} Sync now</button><button class="btn sm" data-a="syncoff">Stop syncing here</button></div><div class="stt" id="m-sync">${esc(SYNC.status())}</div>`
  : `<p>Paste a GitHub token that can only touch gists (make one at github.com → Settings → Developer settings → Tokens (classic), with just the <b>gist</b> box ticked). Use the same token on your Mac and your phone. It's stored in this browser only.</p>
  <label>GitHub token</label><input id="m-gh" type="password" placeholder="ghp_…" autocomplete="off"><div class="rowb"><button class="btn sm gold" data-a="syncon">Connect</button></div><div class="stt" id="m-sync"></div>`}
  <h3>${ic('upload')} Anki (private — only on this browser)</h3>
  <p>Mastered names that have a card in your deck: <b class="y">${ready.length}</b> ready${Object.keys(ST.sent).length ? ' · ' + Object.keys(ST.sent).length + ' already sent' : ''}. Copy the sync code and paste it to Claude ("sync my HK map game") — Claude unsuspends those cards in Anki.</p>
  <div class="rowb"><button class="btn sm gold" data-a="code" ${ready.length ? '' : 'disabled'}>${ic('copy')} Copy sync code</button>${window.showDirectoryPicker ? `<button class="btn sm" data-a="folder">${DIR ? (dirOK ? '✔ Folder linked: ' + esc(DIR.name) : 'Reconnect game folder') : 'Link game folder (desktop)'}</button>` : ''}<button class="btn sm ghost" data-a="ankioff">Turn Anki mode off</button></div>
  <textarea id="m-code" readonly hidden></textarea><div class="stt" id="m-anki"></div>` : ''}
  <h3>Start over</h3>
  <div class="rowb"><button class="btn sm" style="background:#7a1f1a" data-a="reset">${resetArmed ? 'Tap again to erase all progress' : 'Reset progress…'}</button></div>
  <p style="margin-top:14px">Credits: Phaser · Tone.js · ZzFX · canvas-confetti · pixelarticons · Fusion Pixel Font · Hong Kong coastline: Lands Department iB5000 via the CSDI Portal (HKSAR Government) · other map data © OpenStreetMap contributors (ODbL) · photos from Wikimedia Commons (credited on each card) · church data from GCatholic.org.</p>`);
  const st = (id, t) => { const e = $('#' + id); if (e) e.textContent = t; };
  const keep = () => { s.key = $('#m-key').value.trim(); s.region = $('#m-region').value.trim().toLowerCase(); s.voice = $('#m-voice').value; save(); };
  ['m-key', 'm-region', 'm-voice'].forEach(id => $('#' + id).addEventListener('change', keep));
  bind(BOX, {
    x: () => { keep(); resetArmed = false; closeModal(); },
    music: () => { keep(); MUSIC.toggle(); openSettings(); }, sfx: () => { keep(); s.sfx = !s.sfx; save(); openSettings(); }, tones: () => { keep(); s.tones = !s.tones; ST.flags.tonesSet = 1; save(); openSettings(); },
    test: async () => { keep(); st('m-audio', 'Asking Azure…'); try { const b = await azure('尖沙咀'); MUSIC.duck(true); await playUrl(URL.createObjectURL(b)); st('m-audio', 'Works! 好嘢 Hóu yéh!'); } catch (e) { st('m-audio', s.key ? 'Azure did not answer (' + (e.message || e) + '). Check the key and region.' : 'No key: names use the recordings or your device voice.'); } finally { MUSIC.duck(false); } },
    all: async () => { keep(); let n = 0, made = 0, fail = 0, copied = 0; for (const it of ITEMS) { n++; const f = fileOf(it.k); if (BUNDLED.has(f)) continue; const have = await dbGet('audio', f); if (have) { if (ANKI && DIR && dirOK) { await saveToFolder(f, have); copied++; } continue; } if (!s.key) continue; st('m-audio', 'Making sound files… ' + n + '/' + ITEMS.length); try { await audioFor(it, true); made++; } catch (e) { if (++fail > 3) { st('m-audio', 'Stopped: ' + (e.message || e)); return; } } } for (const [hz, v] of allLines()) { const f = lineFile(hz, v); if (BUNDLED.has(f)) continue; const have = await dbGet('audio', f); if (have) { if (ANKI && DIR && dirOK) { await saveToFolder(f, have); copied++; } continue; } if (!s.key) continue; st('m-audio', 'Making voice lines… ' + hz); try { await lineUrl(hz, v, true); made++; } catch (e) { if (++fail > 3) { st('m-audio', 'Stopped: ' + (e.message || e)); return; } } }
      st('m-audio', 'Done: ' + made + ' new sound files' + (copied ? ', ' + copied + ' copied' : '') + '.' + (ANKI && dirOK ? ' Saved in your game folder too.' : '') + (!s.key && !made ? ' (No Azure key: nothing new made.)' : '')); },
    exp: () => { const b = new Blob([JSON.stringify(publicState(), null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hk-map-progress-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); st('m-prog', 'Saved.'); },
    code: async () => { const ks = ankiReady().map(i => i.k); const code = 'HKMAP-ANKI ' + today() + ' ' + ks.join(' '); const ta = $('#m-code'); ta.hidden = false; ta.value = code; ta.select(); try { await navigator.clipboard.writeText(code); } catch (e) { document.execCommand && document.execCommand('copy'); } ks.forEach(k => ST.sent[k] = today()); save(); st('m-anki', 'Copied ' + ks.length + ' names. Paste the code to Claude.'); },
    folder: async () => { try { if (DIR && !dirOK && await reconnectFolder(true)) {} else { const h = await window.showDirectoryPicker({ id: 'hkmapgame', mode: 'readwrite' }); await dbSet('kv', 'dir', h); await useFolder(h); } openSettings(); } catch (e) { st('m-anki', e.message || String(e)); } },
    syncon: async () => { const t = ($('#m-gh') || {}).value || ''; if (!t.trim()) return st('m-sync', 'Paste the token first.'); st('m-sync', 'Connecting…'); await SYNC.connect(t); if (/failed/.test(SYNC.status())) { st('m-sync', SYNC.status()); SYNC.off(); } else openSettings(); },
    syncnow: async () => { st('m-sync', 'Syncing…'); await SYNC.run(); st('m-sync', SYNC.status()); },
    syncoff: () => { SYNC.off(); openSettings(); },
    ankioff: () => { try { localStorage.removeItem('hkmap-anki'); } catch (e) {} location.reload(); },
    reset: () => { keep(); if (!resetArmed) { resetArmed = true; openSettings(); return; } resetArmed = false; const k = ST.settings; ST = fresh(); ST.settings = k; save(); closeModal(); },
  });
  $('#m-imp').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { importState(JSON.parse(await f.text())); st('m-prog', 'Loaded. Welcome back!'); MAP.refresh(); } catch (err) { st('m-prog', 'Could not read that file: ' + (err.message || err)); } });
}

// ---------- start ----------
/*__MINIGAMES__*/
let GAME = null;
if (params.has('debug')) window.__hk = { G, map: () => MAP, ST: () => ST, areaKeyAt: (x, y, c) => areaKeyAt(x, y, c), runMini: id => runMini(id) };
function start() {
  loadLocal(); SYNC.run(); pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {}
  if (ANKI) reconnectFolder(false);
  // iPhone keyboard: iOS shrinks and scrolls the *visual* viewport only, so #ui is resized and moved to match it
  const vv = window.visualViewport; let vvRaf = 0, lastVV = '';
  const syncVV = () => { cancelAnimationFrame(vvRaf); vvRaf = requestAnimationFrame(() => {
    const h = vv ? vv.height : innerHeight, t = vv ? Math.max(0, vv.offsetTop) : 0, R = document.documentElement.style;
    R.setProperty('--vvh', Math.round(h) + 'px'); R.setProperty('--vvt', Math.round(t) + 'px');
    // keyboard = a text box has focus on a touch screen (iOS Chrome shrinks innerHeight too, so heights can't tell)
    const ae = document.activeElement, kb = touch && !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.type !== 'checkbox' && ae.type !== 'file';
    const B = document.body.classList; B.toggle('kb', kb);
    const sw = screen.width, sh = screen.height, sideways = (screen.orientation && screen.orientation.type ? screen.orientation.type.startsWith('landscape') : innerWidth > innerHeight) && Math.min(sw, sh) <= 500;
    B.toggle('land', !kb && sideways); B.toggle('short', !kb && (sideways || innerHeight <= 500));
    if (!kb && (scrollY || document.documentElement.scrollTop)) scrollTo(0, 0);
    placeBao(); const key = Math.round(h) + 'x' + innerWidth; if (GAME && GAME.isBooted && GAME.canvas && key !== lastVV) { lastVV = key; GAME.scale.refresh(); } }); };
  if (vv) { vv.addEventListener('resize', syncVV); vv.addEventListener('scroll', syncVV); }
  addEventListener('focusout', () => setTimeout(syncVV, 120)); addEventListener('focusin', syncVV); addEventListener('resize', syncVV); addEventListener('orientationchange', () => setTimeout(syncVV, 300)); syncVV();
  window.addEventListener('resize', () => setTimeout(placeBao, 60));
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  document.fonts.load('12px FP', '港鐵Āā').catch(() => {}).finally(() => {
    GAME = new Phaser.Game({ type: Phaser.AUTO, parent: 'map', backgroundColor: DATA.sea || '#3a6c9b', pixelArt: true, roundPixels: false, antialias: false,
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' }, loader: { imageLoadType: 'HTMLImageElement' }, input: { activePointers: 3 }, scene: [MapScene] });
  });
}
start();
})();
