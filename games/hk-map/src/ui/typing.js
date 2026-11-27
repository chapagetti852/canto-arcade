import { esc, ic, pick, touch } from "../core/util.js";
import { sfx } from "../audio/music.js";
import { SAY, baoSay } from "./bao.js";
import { UI } from "./dom.js";
import { say } from "../audio/voice.js";
import { base, checkYale, nfd, toneInput } from "../yale/yale.js";
import { G } from "../game/G.js";
import { MAP } from "../scenes/MapScene.js";
import { ST } from "../core/state.js";

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

export { askYale, cancelTyping, typebarHTML };
