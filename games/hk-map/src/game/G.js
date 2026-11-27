import Phaser from 'phaser';
import { $, BY, DATA, GEO, ITEMS, LEVELS, LINES, PX_M, esc, ic, isArea, pick, shuffle, sleep, touch, typeColor } from "../core/util";
import { ANKI } from "../core/anki";
import { MUSIC, sfx } from "../audio/music";
import { SAY, baoSay, hideBao, showBao } from "../ui/bao";
import { KEYS, UI, banner, bind, burst, clearUI, setCenter, setHud, setKEYS, setSheet, setSide, show, toast } from "../ui/dom";
import { areaKeyAt, districtAt, inPoly, lineBounds, rideStops } from "../map/geo";
import { say } from "../audio/voice";
import { closeModal, openModal } from "../ui/modal";
import { MG, MG_GATE, openMinis, runMini } from "../minigames/mini";
import { factIt, hideFact, setFactIt, showFact } from "../ui/fact";
import { credit_, photoUrl } from "../ui/photos";
import { askYale, cancelTyping, typebarHTML } from "../ui/typing";
import { KDOWN, PADV, SNACKS, makeWorld, nearestItem, openSnackBook, seaAt, toastMini } from "../world/roam";
import { openCollection } from "../ui/collection";
import { openSettings } from "../ui/settings";
import { MAP } from "../scenes/MapScene";
import { DIR, dirOK, reconnectFolder, save } from "../core/save";
import { MISSIONS, RANKS, ST, addPoints, ankiReady, credit, currentLevel, debit, gatePending, levelStats, mastered, meet, mission, missionsToday, nextStep, rankOf, rec, starStr, stars, streak, today, unlocked, xp } from "../core/state";

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
  enter(mode) { document.body.classList.remove('roam', 'factopen'); try { MAP.cam.panEffect.reset(); MAP.cam.zoomEffect.reset(); MAP.lastFit = null; } catch (e) {} G.run++; G.mode = mode; G.tick = null; cancelTyping(); clearUI(); MAP.clearFx(); MAP.drag = false; MAP.wheelOK = false; MAP.onTap = null; MAP.labelMinZ = 0; G.geoLabels = true; G.geoBorders = true; setFactIt(null); return G.run; },
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
      <div class="row lnk"><button class="link" data-a="journey">${ic('flag')} All levels</button><a class="link" id="arcade" href="../../" title="Back to the arcade">◀ 機舖 <span class="y">Gēipou</span></a><span class="spacer"></span><span class="en">${R[1]} ${R[2]} · ${ic('fire')}${streak()}</span></div>
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
    bind(UI.center, go); setKEYS({ Enter: go.go, 1: go.journey, 2: () => seen && go.practice(), 3: () => seen >= 4 && go.rush(), 4: go.roam, 5: go.col, 6: go.ride, 7: go.set });
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
    setKEYS({ Escape: () => G.home(), Enter: () => G.level(cur) });
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
    bind(UI.sheet, go); setKEYS({ 1: go.tour, 2: go.prac, Escape: go.back, Enter: S.met === S.n && !S.cleared ? go.prac : go.tour });
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
    setKEYS({ Escape: () => G.home() });
  },

  // ----- rides & tours -----
  async ride(r) {
    const run = G.enter('ride'); let stops, title, color, kind;
    if (r.type === 'line') { const L = LINES[r.id]; stops = [{ it: BY['L:' + r.id], isLine: true }, ...rideStops(r.id)]; color = L.color; title = L.hz + ' ' + L.yale; kind = 'train'; }
    else if (r.type === 'level') { const L = LEVELS[r.n - 1]; let prev = null; stops = L.keys.map(k => { const it = BY[k], s = { it, from: prev, isLine: it.t === 'l', area: isArea(it) }; if (!s.isLine && !s.area) prev = it; return s; }); color = '#f6c945'; title = 'Lv ' + r.n + ' · ' + L.zh + ' ' + L.yale; kind = 'walk'; }
    else { const T = DATA.tours.find(t => t.id === r.id); let prev = null; stops = T.items.map(k => { const s = { it: BY[k], from: prev }; prev = BY[k]; return s; }); color = '#c0862f'; title = '觀光 ' + T.en; kind = 'bus'; }
    const keys = new Set(stops.map(s => s.it.k));
    MAP.setRules(it => keys.has(it.k) ? (stars(it) ? true : 'faint') : false, it => keys.has(it.k) && stars(it) > 0);
    MUSIC.play('ride'); MUSIC.jingle('doors'); setKEYS({ Escape: () => G.home() });
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
    bind(UI.hud, { home: () => G.home() }); setKEYS({ Escape: () => G.home() });
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
        const nx = () => { setKEYS({}); resolve(ok); }; bind(UI.sheet, { next: nx }); setKEYS({ Enter: nx, ' ': nx, Escape: () => G.home() });
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
    hud(); setKEYS({ Escape: () => G.home() });
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
    const start = focus || BY['S:TSY']; // you always set out from Tsing Yi
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
    setKEYS({ Escape: () => factIt ? hideFact() : G.home(), Enter: () => factIt ? hideFact() : R.near && visit(R.near), ' ': () => factIt ? hideFact() : R.near && visit(R.near), '+': () => MAP.zoomBy(1.3), '=': () => MAP.zoomBy(1.3), '-': () => MAP.zoomBy(0.77) });
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

export { G };
