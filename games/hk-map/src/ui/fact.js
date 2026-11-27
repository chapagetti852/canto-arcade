import { $, BY, LINES, TYPE, esc, ic, typeColor } from "../core/util.js";
import { UI, bind, setSheet, setSide } from "./dom.js";
import { say } from "../audio/voice.js";
import { MG, MG_AT } from "../minigames/mini.js";
import { credit_, photoUrl, photosOf } from "./photos.js";
import { mastered, starStr, stars } from "../core/state.js";

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
let factIt = null; function setFactIt(v) { factIt = v; }
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

export { factHTML, factIt, hideFact, setFactIt, showFact };
