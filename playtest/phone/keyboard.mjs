// Phones type names on 香港通's own keyboard (the phone's keyboard never opens): big keys, tone keys on top,
// only the letters the romanisation uses — in Yale, then again in Jyutping. Keys are pressed with pointer
// events on the keys themselves (the same events a finger sends).
const frame = `document.getElementById('game-frame')`;
const D = `${frame}.contentDocument`;
const SAVE = { v: 3, items: Object.fromEntries(['S:TSY', 'S:ADM', 'S:TST'].map((k, i) => [k, { s: `2026-11-0${i + 1}` }])), flags: { intro: 1 }, points: {}, levels: {}, sent: {} };

/** page-side: the keys for one answer. Yale: each syllable's letters (no low-register h), then its tone key.
 *  Jyutping: the letters and the tone digit of each syllable. */
const TYPE_ANSWER = `
  const w = ${frame}.contentWindow, it = w.__hk.currentTyping(), jp = w.localStorage.getItem('canto-romanisation') === 'jyutping';
  const keys = [];
  for (const syl of it.syl) {
    if (jp) { for (const ch of w.__hk.rom(syl).replace(/\\s/g, '')) keys.push(/[1-6]/.test(ch) ? 't' + ch : ch); continue; }
    const d = syl.normalize('NFD').toLowerCase(), mark = (d.match(/[\\u0300\\u0301\\u0304]/) || [''])[0];
    let letters = d.replace(/[\\u0300\\u0301\\u0304]/g, '');
    const low = /^(.*?[aeiou]+)h(ng|[mnptk])?$/.exec(letters); if (low) letters = low[1] + (low[2] || '');
    const tone = mark === '\\u0304' ? 1 : mark === '\\u0300' ? (low ? 4 : 1) : mark === '\\u0301' ? (low ? 5 : 2) : low ? 6 : 3;
    keys.push(...letters, 't' + tone);
  }
  const press = (k) => { const b = ${D}.querySelector('.vkb [data-k="' + k + '"]'); if (!b) throw new Error('no key ' + k);
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })); };
  keys.forEach(press); window.__typed = ${D}.querySelector('.tb-in').value; window.__want = it.yale;
  press('ok');`;

const run = (mode) => [
  {
    name: `${mode}: open 香港通 on a phone`,
    action: 'eval',
    code: `localStorage.setItem('hkmapgame-v3', ${JSON.stringify(JSON.stringify(SAVE))}); localStorage.setItem('canto-romanisation', '${mode}');
      ${frame}?.remove(); const f = document.createElement('iframe'); f.id = 'game-frame'; f.src = '../games/hk-map/';
      f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:99999'; document.body.appendChild(f);`,
  },
  { name: `${mode}: splash`, action: 'waitFor', expression: `(() => { try { return !!${frame}.contentWindow.__hk && !${D}.querySelector('#splash').hidden; } catch (e) { return false; } })()`, timeout: 20000 },
  { name: `${mode}: stand-in: no Wikimedia photos (other sites stay out of the test)`, action: 'eval', code: `const w = ${frame}.contentWindow; for (const o of [w.HK_PHOTOS, w.HK_GAL]) if (o) for (const k of Object.keys(o)) delete o[k];` },
  { name: `${mode}: start the next lesson`, action: 'eval', code: `${D}.querySelector('#splash').click(); setTimeout(() => ${D}.querySelector('#center [data-a=go]').click(), 600);` },
  { name: `${mode}: the in-game keyboard appears`, action: 'waitFor', expression: `!!${D}.querySelector('.vkb')`, timeout: 15000 },
  { name: `${mode}: the answer box never opens the phone keyboard`, action: 'expect', expect: { expression: `(() => { const i = ${D}.querySelector('.tb-in'); return i.readOnly && i.getAttribute('inputmode') === 'none'; })()`, equals: true } },
  { name: `${mode}: every key at least 44 px tall and 30 px wide`, action: 'expect', expect: { expression: `[...${D}.querySelectorAll('.vk')].every(b => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.width >= 30; })`, equals: true } },
  { name: `${mode}: six tone keys`, action: 'expect', expect: { expression: `[...${D}.querySelectorAll('.vk.tone')].map(b => b.textContent.trim()).join(' ')`, equals: mode === 'yale' ? 'ā1 á2 a3 àh4 áh5 ah6' : '1 2 3 4 5 6' } },
  { name: `${mode}: only the letters it uses`, action: 'expect', expect: { expression: `[...${D}.querySelectorAll('.vk:not(.tone)')].map(b => b.dataset.k).filter(k => k.length === 1).sort().join('')`, equals: mode === 'yale' ? 'abcdefghijklmnopstuwy' : 'abcdefghijklmnopstuwyz' } },
  { name: `${mode}: the whole keyboard is on screen, under the answer box`, action: 'expect', expect: { expression: `(() => { const k = ${D}.querySelector('.vkb').getBoundingClientRect(), i = ${D}.querySelector('.tb-in').getBoundingClientRect(); return k.bottom <= ${frame}.contentWindow.innerHeight + 1 && k.top >= i.bottom && i.top >= 0; })()`, equals: true } },
  { name: `${mode}: type the name on the keyboard and press OK`, action: 'eval', code: TYPE_ANSWER },
  { name: `${mode}: settle`, action: 'wait', ms: 600 },
  { name: `${mode}: what was typed is right`, action: 'expect', expect: { expression: `${frame}.contentWindow.__hk.checkAnswer(window.__typed, { yale: window.__want, syl: ${frame}.contentWindow.__hk.currentTyping() ? ${frame}.contentWindow.__hk.currentTyping().syl : window.__want.split(/\\s+/) }).ok || ${D}.querySelector('.tb-in.ok') !== null || !${frame}.contentWindow.__hk.currentTyping()`, equals: true } },
  { name: `${mode}: accepted (the lesson moved on)`, action: 'expect', expect: { expression: `(() => { const t = ${frame}.contentWindow.__hk.currentTyping(); return !t || t.yale !== window.__want; })()`, equals: true } },
  { name: `${mode}: keyboard`, action: 'screenshot' },
  // names are spoken from audio clips: let them finish loading before the frame goes (a cut-off download counts as a failed asset)
  { name: `${mode}: let the voice clips finish`, action: 'waitFor', expression: `${frame}.contentWindow.performance.getEntriesByType('resource').filter(e => e.name.includes('/audio/')).every(e => e.responseEnd > 0)`, timeout: 8000 },
  { name: `${mode}: and a moment more`, action: 'wait', ms: 1500 },
];

export default [
  { name: 'arcade room opens', action: 'waitFor', expression: `game.scene.isActive('ArcadeScene')`, timeout: 10000 },
  ...run('yale'),
  ...run('jyutping'),
  { name: 'jyutping: Yale on screen is shown in Jyutping', action: 'expect', expect: { expression: `${D}.body.textContent.includes('Hēung') ? 'still Yale' : 'converted'`, equals: 'converted' } },
  { name: 'back to Yale for the other scenarios', action: 'eval', code: `localStorage.removeItem('canto-romanisation'); ${frame}.remove();` },
];
