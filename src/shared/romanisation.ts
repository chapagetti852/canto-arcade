// Yale ↔ Jyutping, and the reader's choice between them (shared by the arcade and every game).
//
// Yale with tone marks is the source of truth everywhere (data, Anki cards, answers). A reader who prefers
// Jyutping sees every Yale word converted at display time, and types answers in Jyutping; both are checked
// syllable by syllable against the same Yale.
//
// Yale → Jyutping, per syllable:
//   initials  j → z, ch → c, y → j (y + u… → jyu…), the rest unchanged
//   finals    open a → aa, eu → oe, eui → eoi, eun → eon, eung → oeng, euk → oek, eut → eot, the rest unchanged
//   tones     ā/à 1 · á 2 · a 3 · àh 4 · áh 5 · ah 6 (the h after the vowel marks the low register)

export type Romanisation = 'yale' | 'jyutping';
/** localStorage key, shared by every game on the site */
export const ROM_KEY = 'canto-romanisation';

export function getRomanisation(): Romanisation {
  try { return localStorage.getItem(ROM_KEY) === 'jyutping' ? 'jyutping' : 'yale'; } catch { return 'yale'; }
}
/** Has this browser been asked yet? */
export function romanisationChosen(): boolean {
  try { return !!localStorage.getItem(ROM_KEY); } catch { return true; }
}
export function setRomanisation(r: Romanisation) {
  try { localStorage.setItem(ROM_KEY, r); } catch { /* private mode: stays Yale */ }
}

const INITIALS = ['gw', 'kw', 'ng', 'ch', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'w', 'j', 's', 'y'];
/** every Yale final (without tone), and its Jyutping */
const FINALS: Record<string, string> = {
  a: 'aa', aa: 'aa', aai: 'aai', aau: 'aau', aam: 'aam', aan: 'aan', aang: 'aang', aap: 'aap', aat: 'aat', aak: 'aak',
  ai: 'ai', au: 'au', am: 'am', an: 'an', ang: 'ang', ap: 'ap', at: 'at', ak: 'ak',
  e: 'e', ei: 'ei', eng: 'eng', ek: 'ek', em: 'em', ep: 'ep', eu: 'oe', eung: 'oeng', euk: 'oek', eui: 'eoi', eun: 'eon', eut: 'eot',
  i: 'i', iu: 'iu', im: 'im', in: 'in', ing: 'ing', ip: 'ip', it: 'it', ik: 'ik',
  o: 'o', oi: 'oi', ou: 'ou', on: 'on', ong: 'ong', ot: 'ot', ok: 'ok',
  u: 'u', ui: 'ui', un: 'un', ung: 'ung', ut: 'ut', uk: 'uk',
  yu: 'yu', yun: 'yun', yut: 'yut',
};
const INIT_JP: Record<string, string> = { j: 'z', ch: 'c', y: 'j' };
const MARKS = /[̀́̄]/g;

export interface Syllable { initial: string; final: string; tone: number }

/** One Yale syllable (any case, with or without tone marks) → its parts, or null if it isn't one. */
export function parseYale(syl: string): Syllable | null {
  const d = syl.normalize('NFD').toLowerCase();
  const mark = d.match(MARKS)?.[0];
  let s = d.replace(MARKS, '');
  if (!/^[a-z]+$/.test(s)) return null;
  // syllabic nasals: m (唔), ng (五)
  const nas = s.match(/^(m|ng)(h?)$/);
  if (nas) return { initial: '', final: nas[1], tone: tone(mark, !!nas[2]) };
  let initial = '';
  for (const i of INITIALS) if (s.startsWith(i) && s.length > i.length) { initial = i; break; }
  s = s.slice(initial.length);
  // the vowels, then the low-register h, then the coda (Yale writes the h after a glide too: saih, yauh)
  const m = s.match(/^(yu[aeiou]*|[aeiou]+)(h?)(ng|[mnptk])?$/);
  if (!m) return null;
  const [, v, h, coda = ''] = m;
  if (h && mark === '\u0304') return null; // tone 1 never takes the low-register h
  let final = v + coda;
  // after y, a final starting with u is the yu- final when there is one (yùh 魚 = jyu4, yuht 月 = jyut6),
  // else plain u- (yuhk 玉 = juk6, yuhng 用 = jung6)
  if (initial === 'y' && final.startsWith('u') && ('y' + final) in FINALS) final = 'y' + final;
  if (!(final in FINALS)) return null;
  return { initial, final, tone: tone(mark, !!h) };
}

function tone(mark: string | undefined, low: boolean): number {
  if (mark === '̄') return 1;
  if (mark === '̀') return low ? 4 : 1;
  if (mark === '́') return low ? 5 : 2;
  return low ? 6 : 3;
}

export function syllableToJyutping(p: Syllable): string {
  const fin = FINALS[p.final] ?? p.final;
  let ini = INIT_JP[p.initial] ?? p.initial;
  if (p.initial === 'y' && fin.startsWith('yu')) ini = 'j';
  return ini + fin + p.tone;
}

/**
 * Yale syllables, run together into words as Yale writes them, split back apart. Of the possible splits:
 * the fewest syllables without an initial (they are rare: Sā·tìhn, not Sāt·ìhn), then the fewest syllables,
 * then the longest earlier syllables (lùhngwāan = lùhng·wāan, not lùhn·gwāan).
 */
const bare = (syl: string) => (parseYale(syl)?.initial ? 0 : 1);
function better(a: string[], b: string[]) {
  const na = a.reduce((n, s) => n + bare(s), 0), nb = b.reduce((n, s) => n + bare(s), 0);
  if (na !== nb) return na < nb;
  if (a.length !== b.length) return a.length < b.length;
  return longerFirst(a, b);
}
function longerFirst(a: string[], b: string[]) { for (let k = 0; k < a.length; k++) if (a[k].length !== b[k].length) return a[k].length > b[k].length; return false; }

export function splitYaleWord(word: string): string[] | null {
  const w = word.normalize('NFC');
  const n = w.length, best: (string[] | null)[] = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    for (let j = i + 1; j <= Math.min(n, i + 8); j++) {
      const piece = w.slice(i, j);
      if (!parseYale(piece)) continue;
      const cand = [...best[i]!, piece], cur = best[j];
      if (!cur || better(cand, cur)) best[j] = cand;
    }
  }
  return best[n];
}

/**
 * A Yale word → Jyutping ("Jūng'wàahn" → "zung1 waan4"), or null when it isn't Yale. With `strict`, a word
 * that has no tone mark and no low-register h is left alone unless every piece parses (so English stays English
 * in mixed text: only call with strict=false on text known to be Yale).
 */
export function yaleWordToJyutping(word: string): string | null {
  const parts = word.split(/['’\-]/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const syl = splitYaleWord(p);
    if (!syl) return null;
    out.push(...syl.map((s) => syllableToJyutping(parseYale(s)!)));
  }
  return out.join(' ');
}

/** Any text written in Yale → Jyutping, word by word; anything that isn't Yale (English, Chinese, numbers) stays. */
export function yaleTextToJyutping(text: string): string {
  return text.replace(/[A-Za-zÀ-ɏ̀-ͯ'’\-]+/g, (w) => {
    const core = w.replace(/^['’\-]+|['’\-]+$/g, '');
    if (!core) return w;
    const j = yaleWordToJyutping(core); // Jyutping is written in lower case, even in names
    return j == null ? w : w.replace(core, j);
  });
}

/** Show Yale text in the reader's chosen romanisation. */
export function rom(yale: string, r: Romanisation = getRomanisation()): string {
  return r === 'jyutping' ? yaleTextToJyutping(yale) : yale;
}

/**
 * Lenient Jyutping answer check against the Yale syllables: case, spaces and punctuation never matter;
 * a tones-only miss says which syllables are off (the same shape as the Yale checker).
 */
export function checkJyutping(typed: string, sylYale: string[]): { ok: boolean; empty?: boolean; tones?: boolean; parts?: { syl: string; right: boolean }[] } {
  const want = sylYale.map((s) => { const p = parseYale(s); return p ? syllableToJyutping(p) : s.toLowerCase(); });
  const t = typed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return { ok: false, empty: true };
  if (t === want.join('')) return { ok: true };
  const bare = (s: string) => s.replace(/[0-9]/g, '');
  if (bare(t) === bare(want.join(''))) {
    // walk the typed answer syllable by syllable: letters, then whatever digits follow
    const parts: { syl: string; right: boolean }[] = []; let i = 0;
    for (const w of want) { const letters = bare(w); i += letters.length; let digits = ''; while (i < t.length && /[0-9]/.test(t[i])) digits += t[i++]; parts.push({ syl: w, right: digits === w.replace(/[a-z]/g, '') }); }
    return { ok: false, tones: true, parts };
  }
  return { ok: false };
}
