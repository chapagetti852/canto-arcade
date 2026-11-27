import { $, esc } from "../core/util";
import { ANKI } from "../core/anki";
import { MUSIC, sfx } from "../audio/music";
import { hideBao, placeBao } from "./bao";

// ---------- DOM UI ----------
const UI = { root: $('#ui'), hud: $('#hud'), sheet: $('#sheet'), side: $('#side'), center: $('#center'), pad: $('#pad'), zoom: $('#zoom'), bao: $('#bao'), toasts: $('#toasts') };
let KEYS = {}; function setKEYS(v) { KEYS = v; } // keyboard shortcuts for the current screen
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

export { KEYS, UI, banner, bind, burst, clearUI, insets, rel, setCenter, setHud, setKEYS, setSheet, setSide, show, stampFx, toast };
