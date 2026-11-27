import { $ } from "../core/util";
import { factIt, hideFact } from "./fact";
import { G } from "../game/G";

// ---------- dialogs (the modal box) ----------
const MODAL = $('#modal'), BOX = $('#modal-box');
const modalOpen = () => MODAL.style.display === 'flex';
function openModal(html, wide) { BOX.className = 'box panel' + (wide ? ' wide' : ''); BOX.innerHTML = html; MODAL.style.display = 'flex'; }
function closeModal(home = true) { MODAL.style.display = 'none'; hideFact(); if (home) G.home(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOpen()) { e.stopPropagation(); if (factIt) hideFact(); else closeModal(); } }, true);

export { BOX, closeModal, modalOpen, openModal };
