// The way back to the arcade (◀ 機舖) must never sit on top of another button, in either game,
// on any screen, at desktop or phone size. `npm run verify` runs this twice: at 1280×720 with the
// other scenarios, and with --device iphone (390×844, touch) through playtest/phone/. Each run checks the full
// window and a 664px-tall one too: an iPhone in Safari, with its toolbars, is 390×664.
//
// Each game is opened in a full-window iframe over the arcade, so the arcade page (and the
// harness's hooks into it) stays loaded. Every screen is driven by calling the game itself,
// then PROBE measures each visible way back to the arcade against every other visible control.
// Only places where the back link really shows, and the other control is really underneath it
// (both checked with elementFromPoint), count.

/**
 * Page-side: returns the overlaps on the screen showing in window `w`.
 * A "way back" is a DOM link to `../../` (or `[data-arcade-back]`), or a Phaser object named
 * `arcade-back`. Every other visible control is checked against it: DOM buttons, links, inputs,
 * and every input-enabled Phaser object.
 */
export const PROBE = String.raw`(w) => {
  const d = w.document, g = w.__PHASER_GAME__;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.right > 0 && r.bottom > 0 && r.left < w.innerWidth && r.top < w.innerHeight; };
  const cut = (a, b) => { const x = Math.max(a.left, b.left), y = Math.max(a.top, b.top), r = Math.min(a.right, b.right), bt = Math.min(a.bottom, b.bottom); return r - x > 1 && bt - y > 1 ? { left: x, top: y, right: r, bottom: bt } : null; };
  const label = (el) => (el.id ? '#' + el.id + ' ' : '') + (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  // Interactive Phaser objects, with their page rectangles.
  const objs = [];
  if (g && g.canvas && vis(g.canvas)) {
    const cr = g.canvas.getBoundingClientRect(), k = cr.width / g.canvas.width;
    for (const s of g.scene.getScenes(true)) {
      const cam = s.cameras.main;
      for (const o of s.children.list) {
        if (!o.input || !o.input.enabled || !o.visible || o.alpha === 0 || !o.getBounds) continue;
        const gb = o.getBounds(), left = cr.left + (gb.x - cam.worldView.x) * cam.zoom * k, top = cr.top + (gb.y - cam.worldView.y) * cam.zoom * k;
        objs.push({ o, name: s.scene.key + ': ' + (o.text || o.name || o.type), rect: { left, top, right: left + gb.width * cam.zoom * k, bottom: top + gb.height * cam.zoom * k } });
      }
    }
  }
  const domBacks = [...d.querySelectorAll('a[href="../../"], [data-arcade-back]')].filter(vis);
  const backs = [...domBacks.map((el) => ({ el, name: label(el), rect: el.getBoundingClientRect() })), ...objs.filter((x) => x.o.name === 'arcade-back')];
  // Candidate pairs: the back link's box cut with each other control's box.
  const sel = 'button, a[href], input, textarea, select, summary, [role=button], [data-a], .btn';
  const others = [...d.querySelectorAll(sel)].filter((el) => !domBacks.some((b) => b === el || b.contains(el) || el.contains(b)) && vis(el));
  const pairs = [];
  for (const b of backs) {
    for (const el of others) { const box = cut(b.rect, el.getBoundingClientRect()); if (box) pairs.push({ b, box, other: label(el), test: (h) => !!h && (h === el || el.contains(h)) }); }
    for (const x of objs) { if (x.o === b.o || x.o.name === 'arcade-back') continue; const box = cut(b.rect, x.rect); if (box) pairs.push({ b, box, other: x.name, test: (h) => h === g.canvas }); }
  }
  // Sample points in each overlap: the back link must be what shows there (not hidden under a
  // dialog), and with it set aside the other control must be what is underneath.
  const pts = (box) => { const p = []; for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) p.push([box.left + (box.right - box.left) * i / 4, box.top + (box.bottom - box.top) * j / 4]); return p; };
  const at = (x, y) => d.elementFromPoint(x, y);
  pairs.forEach((p) => { p.shown = pts(p.box).map(([x, y]) => { const h = at(x, y); return !!h && (p.b.el ? (h === p.b.el || p.b.el.contains(h)) : h === g.canvas); }); });
  const saved = domBacks.map((b) => b.style.visibility);
  domBacks.forEach((b) => { b.style.visibility = 'hidden'; });
  const out = [];
  try {
    pairs.forEach((p) => { if (pts(p.box).some(([x, y], i) => p.shown[i] && p.test(at(x, y)))) out.push({ back: p.b.name, other: p.other, box: [p.box.left, p.box.top, p.box.right - p.box.left, p.box.bottom - p.box.top].map(Math.round) }); });
  } finally { domBacks.forEach((b, i) => { b.style.visibility = saved[i]; }); }
  return { backs: backs.length, overlaps: out, rects: backs.map((b) => [b.rect.left, b.rect.top, b.rect.right - b.rect.left, b.rect.bottom - b.rect.top]) };
}`;

/** Page-side helpers every `go` and `reset` can use: `h(code)` runs code against 香港通's hook. */
export const HELPERS = `const h = (c) => new w.Function('with (this) { ' + c + ' }').call(w.__hk);`;

const SEEN = { items: Object.fromEntries(['S:TSY', 'S:ADM', 'S:TST', 'S:CEN', 'S:KOT', 'S:NOP'].map((k, i) => [k, { s: `2026-11-0${i + 1}` }])) };

/**
 * The screens of each game. `go` is a page-side function body run with the game's window as `w`
 * (it may return a promise). A third entry `true` means the way back must show on that screen.
 * 香港通 is driven through window.__hk (G, openSettings, …), Canto Numbers through its scenes.
 */
export const GAMES = [
  {
    id: 'hk-map',
    url: 'games/hk-map/',
    seed: { 'hkmapgame-v3': JSON.stringify(SEEN) },
    ready: `w.__hk && w.document.querySelector('#splash') && !w.document.querySelector('#splash').hidden`,
    screens: [
      ['splash', ``, true],
      ['home', `w.document.querySelector('#splash').click()`, true],
      ['home-more', `h('G.home()'); w.document.querySelector('details.more').open = true`],
      ['all-levels', `h('G.journey()')`],
      ['level', `h('G.level(LEVELS[0])')`],
      ['playing', `h('G.home()'); w.document.querySelector('#center [data-a=go]').click()`],
      ['practice', `h('G.practice()')`],
      ['rush-hour', `h('G.rush()')`],
      ['ride-pick', `h('G.pickRide()')`],
      ['riding', `h('G.pickRide()'); w.document.querySelector('#center .menu button:not(.iconbtn)').click()`],
      ['free-roam', `h('G.roam()')`],
      ['place-card', `h('G.home(); showFact(ITEMS[0])')`],
      ['collection', `h('G.home(); openCollection()')`],
      ['settings', `h('G.home(); openSettings()')`],
      ['mini-games', `h('G.home(); openMinis()')`],
      ['mini-game', `h('closeModal(false); G.home(); runMini(Object.keys(MG)[0])')`],
      ['snacks', `h('G.home(); openSnackBook()')`],
    ],
    // Back to a clean home between screens, so one screen's leftovers never mask another's.
    reset: `try { h('document.querySelectorAll(".mg-box, .lbx").forEach(e => e.remove()); document.body.classList.remove("mg"); if (modalOpen()) closeModal(false); if (G.mode !== "boot") G.home()'); } catch (e) {}`,
  },
  {
    id: 'canto-numbers',
    url: 'games/canto-numbers/',
    seed: {},
    ready: `w.__PHASER_GAME__ && w.__PHASER_GAME__.scene.isActive('Menu')`,
    screens: [
      ['menu', ``, true],
      ['levels-listen', `w.__PHASER_GAME__.scene.getScene('Menu').pick('listen')`],
      ['playing-listen', `w.__PHASER_GAME__.scene.getScene('Levels').start(1)`],
      ['levels-read', `const g = w.__PHASER_GAME__; g.scene.getScenes(true)[0].scene.start('Menu'); return new Promise(r => setTimeout(() => { g.scene.getScene('Menu').pick('read'); r(); }, 300))`],
      ['playing-read', `w.__PHASER_GAME__.scene.getScene('Levels').start(1)`],
      ['results', `w.__PHASER_GAME__.scene.getScene('Game').finish()`],
    ],
    reset: ``,
  },
];

const frame = `document.getElementById('game-frame')`;

function gameSteps(gm, height) {
  const tag = `${gm.id} (${height === '100vh' ? 'full window' : height + ' tall'})`;
  const steps = [
    {
      name: `${tag}: open the game in a frame`,
      action: 'eval',
      code: `Object.entries(${JSON.stringify(gm.seed)}).forEach(([k, v]) => localStorage.setItem(k, v));
        ${frame}?.remove();
        const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = ${JSON.stringify(gm.url)};
        f.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:${height};border:0;z-index:99999;background:#000';
        document.body.appendChild(f);`,
    },
    { name: `${tag}: game ready`, action: 'waitFor', expression: `(() => { try { const w = ${frame}.contentWindow; return !!(${gm.ready}); } catch (e) { return false; } })()`, timeout: 20000 },
    { name: `${tag}: settle`, action: 'wait', ms: 1200 },
    // Stand-ins for other sites (as anki.mjs does for AnkiConnect): no Wikimedia photos, and an
    // empty leaderboard. They change nothing about the layout, and keep the test off the network.
    {
      name: `${tag}: stand-ins for other sites`,
      action: 'eval',
      code: `const w = ${frame}.contentWindow;
        for (const o of [w.HK_PHOTOS, w.HK_GAL]) if (o) for (const k of Object.keys(o)) delete o[k];
        const real = w.fetch.bind(w);
        w.fetch = (u, ...a) => new URL(String(u), w.location.href).origin === w.location.origin ? real(u, ...a)
          : Promise.resolve(new w.Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }));`,
    },
  ];
  for (const [screen, go, mustShow] of gm.screens) {
    steps.push(
      { name: `${tag} ${screen}: go`, action: 'eval', code: `const w = ${frame}.contentWindow; ${HELPERS} window.__goErr = ''; window.__go = Promise.resolve((() => { ${gm.reset}; return (() => { ${go} })(); })()).catch(e => { window.__goErr = String(e); });` },
      { name: `${tag} ${screen}: settle`, action: 'wait', ms: 1000 },
      { name: `${tag} ${screen}: reached`, action: 'expect', expect: { expression: `window.__goErr || 'ok'`, equals: 'ok' } },
      ...(mustShow ? [{ name: `${tag} ${screen}: the way back to the arcade shows`, action: 'expect', expect: { expression: `(${PROBE})(${frame}.contentWindow).backs`, atLeast: 1 } }] : []),
      { name: `${tag} ${screen}: the way back covers no button`, action: 'expect', expect: { expression: `JSON.stringify((${PROBE})(${frame}.contentWindow).overlaps)`, equals: '[]' } },
    );
  }
  return steps;
}

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  ...['100vh', '664px'].flatMap((height) => GAMES.flatMap((gm) => gameSteps(gm, height))),
  { name: 'close the frame', action: 'eval', code: `${frame}.remove()` },
];
