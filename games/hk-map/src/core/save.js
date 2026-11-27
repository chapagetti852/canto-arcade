import { ANKI } from "./anki";
import { MAP } from "../scenes/MapScene";
import { DEF_SET, LS, ST, fresh, setST } from "./state";

// ---------- saving: this browser (+ the game folder, Anki mode on desktop Chrome) ----------
let saveTimer = null, DIR = null, dirOK = false;
function loadLocal() { try { const s = localStorage.getItem(LS); if (s) { const o = JSON.parse(s); setST(Object.assign(fresh(), o)); ST.settings = Object.assign({}, DEF_SET, o.settings || {}); ST.sent = ST.sent || {}; ST.levels = ST.levels || {}; if (!ST.flags.tonesSet) ST.settings.tones = true; /* tone keys on for everyone unless switched off by hand */ } } catch (e) {} }
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
      if (JSON.stringify(merged) !== before) { const keep = ST.settings; setST(Object.assign(fresh(), merged)); ST.settings = keep; try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (e) {} if (typeof MAP !== 'undefined' && MAP && MAP.refresh) try { MAP.refresh(); } catch (e) {} }
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
function importState(o) { if (!o || !o.items) throw new Error('Not a progress file'); const keep = ST.settings; setST(Object.assign(fresh(), o)); ST.settings = Object.assign({}, DEF_SET, keep); ST.updated = Date.now(); save(); }
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

export { DIR, SYNC, dbGet, dbSet, dirOK, importState, loadLocal, publicState, reconnectFolder, save, useFolder };
