// 香港通's side of the reader's romanisation choice (Yale or Jyutping, shared with the whole arcade):
// answer checking in either, the tone keys' labels, and turning displayed Yale into Jyutping.
import { checkJyutping, getRomanisation, rom, yaleTextToJyutping, type Romanisation } from '../../../../src/shared/romanisation';
import { checkYale, type YaleCheck } from '../yale/yale';
import type { Item } from '../types';

/** fixed for this page load; changing it in Settings reloads the page */
export const ROMAN: Romanisation = getRomanisation();
export const JP = ROMAN === 'jyutping';
export { rom };

/** the name of the system, for prompts ("Type the Yale…") */
export const ROM_NAME = JP ? 'Jyutping' : 'Yale';

/** Check a typed answer against an item, in the reader's romanisation. */
export function checkAnswer(typed: string, it: Pick<Item, 'yale' | 'syl'>): YaleCheck {
  return JP ? checkJyutping(typed, it.syl) : checkYale(typed, it);
}

/** the six tone keys: [tone, label] */
export const TONE_KEYS: [number, string][] = JP
  ? [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]
  : [[1, 'ā'], [2, 'á'], [3, 'a'], [4, 'àh'], [5, 'áh'], [6, 'ah']];

/**
 * In Jyutping mode, keep every Yale word on screen in Jyutping: inside places that hold only Yale (class "y",
 * "tone", "fyl", a toast's or Bāaujái's second line) every syllable converts; elsewhere only words with a tone
 * mark do, so English stays English.
 */
export function watchRomanisation(root: HTMLElement = document.body) {
  if (!JP) return;
  document.body.classList.add('jp');
  const YALE_ONLY = '.y, .tone, .fyl, .toast i, .bub i, [data-yale]';
  const done = new WeakSet<Text>();
  const hasMark = /[̀́̄āáàēéèīíìōóòūúùǖǘǚǜńǹḿ]/i;
  const fix = (t: Text) => {
    if (done.has(t) || !t.nodeValue || !/[A-Za-z]/.test(t.nodeValue)) return;
    const el = t.parentElement; if (!el || el.closest('script, style, input, textarea, [data-no-rom]')) return;
    const v = t.nodeValue, all = !!el.closest(YALE_ONLY);
    const out = all ? yaleTextToJyutping(v) : v.replace(/[A-Za-zÀ-ɏ̀-ͯ'’]+/g, (w) => (hasMark.test(w.normalize('NFC')) ? yaleTextToJyutping(w) : w));
    done.add(t);
    if (out !== v) t.nodeValue = out;
  };
  const walk = (n: Node) => {
    if (n.nodeType === 3) { fix(n as Text); return; }
    if (n.nodeType !== 1) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t: Node | null;
    while ((t = w.nextNode())) fix(t as Text);
  };
  walk(root);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fix(m.target as Text); m.addedNodes.forEach(walk); } })
    .observe(root, { subtree: true, childList: true, characterData: true });
}
