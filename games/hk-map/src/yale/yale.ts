// ---------- Yale: checking answers, and typing tones with numbers (yau4 → yàuh) ----------
import type { Item } from '../types';

/** The result of checking a typed answer. `tones`: the letters are right, some tones are not (one part per syllable). */
export interface YaleCheck { ok: boolean; empty?: boolean; tones?: boolean; parts?: { syl: string; right: boolean }[] }
const nfd = (s: string) => s.normalize('NFD').toLowerCase().replace(/[^a-z̀-ͯ]/g, '');
const base = (s: string) => s.replace(/[̀-ͯ]/g, '');
function checkYale(typed: string, it: Pick<Item, 'yale' | 'syl'>): YaleCheck {
  const u = nfd(typed), t = nfd(it.yale);
  if (!u) return { ok: false, empty: true };
  if (u === t) return { ok: true };
  if (base(u) === base(t)) {
    const parts: { syl: string; right: boolean }[] = []; let i = 0; const ua = [...u];
    for (const syl of it.syl) { const sn = nfd(syl), need = base(sn).length; let got = '', letters = 0;
      while (i < ua.length && (letters < need || /[̀-ͯ]/.test(ua[i]))) { if (!/[̀-ͯ]/.test(ua[i])) { if (letters === need) break; letters++; } got += ua[i]; i++; }
      parts.push({ syl, right: got === sn }); }
    return { ok: false, tones: true, parts };
  }
  return { ok: false };
}
const INITS = ['ng', 'gw', 'kw', 'ch', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'w', 'j', 's', 'y'];
/** A syllable (or word ending in one) given tone t (1–6), with Yale marks and the low-register h. */
function retone(word: string, t: number): string | null {
  const ch: { c: string; m: string }[] = []; for (const c of word.normalize('NFD')) { if (/[\u0300-\u036f]/.test(c)) { if (ch.length) ch[ch.length - 1].m += c; } else ch.push({ c, m: '' }); }
  const low = ch.map(x => x.c.toLowerCase()).join(''); let i = low.length;
  const mark = ({ 1: '\u0304', 2: '\u0301', 4: '\u0300', 5: '\u0301' } as Record<number, string>)[t] || '';
  if (low.endsWith('ng') && /[aeiouh]/.test(low[i - 3] || '')) i -= 2; else if (/[mnptk]/.test(low[i - 1] || '') && /[aeiouh]/.test(low[i - 2] || '')) i -= 1;
  const codaStart = i; if (low[i - 1] === 'h' && /[aeiou]/.test(low[i - 2] || '')) i -= 1;
  const hPos = i; while (i > 0 && /[aeiou]/.test(low[i - 1])) i--;
  const vStart = i;
  if (vStart === hPos) { // syllabic m / ng (唔 m̀, 五 ńgh)
    const m = low.match(/(ng|m)h?$/); if (!m) return null;
    const b = m[1], len = m[0].length, head = ch.slice(0, ch.length - len).map(x => x.c + x.m).join(''), first = ch[ch.length - len].c;
    return (head + first + mark + b.slice(1) + (t >= 4 && !(b === 'm' && t === 4) ? 'h' : '')).normalize('NFC');
  }
  let j = vStart; while (j > 0 && !/[aeiou]/.test(low[j - 1])) j--;
  const run = low.slice(j, vStart); let ini = ''; for (const I of INITS) if (run.endsWith(I) && I.length > ini.length) ini = I;
  const sStart = vStart - ini.length;
  const head = ch.slice(0, sStart).map(x => x.c + x.m).join(''), iniS = ch.slice(sStart, vStart).map(x => x.c).join(''), vowS = ch.slice(vStart, hPos).map(x => x.c), codaS = ch.slice(codaStart).map(x => x.c).join('');
  return (head + iniS + vowS[0] + mark + vowS.slice(1).join('') + (t >= 4 ? 'h' : '') + codaS).normalize('NFC');
}
function toneInput(inp: HTMLInputElement | HTMLTextAreaElement, t: number): boolean {
  const pos = inp.selectionStart == null ? inp.value.length : inp.selectionStart, before = inp.value.slice(0, pos), after = inp.value.slice(pos);
  const m = before.normalize('NFD').match(/[A-Za-z̀-ͯ]+$/); if (!m) return false;
  const res = retone(m[0], t); if (!res) return false;
  const head = before.normalize('NFD').slice(0, before.normalize('NFD').length - m[0].length).normalize('NFC');
  inp.value = head + res + after; const p = (head + res).length; inp.setSelectionRange(p, p); return true;
}

export { base, checkYale, nfd, retone, toneInput };
