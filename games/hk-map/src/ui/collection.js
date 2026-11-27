import { $, ITEMS, LINES, TYPE, esc, ic, isArea, typeColor } from "../core/util.js";
import { sfx } from "../audio/music.js";
import { bind } from "./dom.js";
import { say } from "../audio/voice.js";
import { BOX, closeModal, openModal } from "./modal.js";
import { factHTML, setFactIt } from "./fact.js";
import { photoUrl } from "./photos.js";
import { cancelTyping } from "./typing.js";
import { G } from "../game/G.js";
import { mastered, starStr, stars } from "../core/state.js";

let colTab = 'all'; // ---------- collection 圖鑑 ----------
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
  document.body.appendChild(ov); setFactIt(it); const close = () => { ov.remove(); setFactIt(null); };
  ov.onclick = e => { if (e.target === ov) close(); }; bind(ov, { say: () => say(it), x: close });
  const esc_ = e => { if (e.key === 'Escape') { close(); e.stopPropagation(); document.removeEventListener('keydown', esc_, true); } }; document.addEventListener('keydown', esc_, true);
  
}

export { openCollection };
