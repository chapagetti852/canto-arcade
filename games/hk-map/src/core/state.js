import { BY, ITEMS, LEVELS } from "./util.js";
import { MUSIC } from "../audio/music.js";
import { burst, stampFx, toast } from "../ui/dom.js";
import { MG, MG_GATE, mgPassed, runMini } from "../minigames/mini.js";
import { G } from "../game/G.js";
import { save } from "./save.js";

// ---------- state ----------
const LS = 'hkmapgame-v3';
const DEF_SET = { voice: 'zh-HK-HiuMaanNeural', region: '', key: '', sfx: true, music: true, tones: true };
const fresh = () => ({ v: 3, items: {}, updated: 0, points: {}, best: {}, missions: null, flags: {}, levels: {}, sent: {}, roamAt: null, settings: Object.assign({}, DEF_SET) });
let ST = fresh(); function setST(v) { ST = v; } // for modules that replace the whole save (load, sync, import, reset)
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

export { DEF_SET, LS, MISSIONS, RANKS, ST, addPoints, ankiReady, credit, currentLevel, debit, fresh, gatePending, hashStr, levelStats, mastered, meet, mission, missionsToday, nextStep, rankOf, rec, setST, starStr, stars, streak, today, unlocked, xp };
