import { BY, PH, esc } from "../core/util.js";
import { sfx } from "../audio/music.js";
import { closeModal, modalOpen } from "./modal.js";
import { runMini } from "../minigames/mini.js";
import { hideFact } from "./fact.js";
import { G } from "../game/G.js";

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

export { credit_, photoUrl, photosOf };
