import { describe, expect, it } from 'vitest';
import { checkYale, retone } from '../src/yale/yale';

const CEN = { yale: "Jūng'wàahn", syl: ['Jūng', 'wàahn'] };

describe('checking a typed name (lenient: only syllables and tones count)', () => {
  it('accepts the exact Yale', () => expect(checkYale("Jūng'wàahn", CEN).ok).toBe(true));
  it('ignores capitals, spaces, apostrophes and hyphens', () => {
    for (const typed of ['jūng wàahn', 'JŪNGWÀAHN', 'jūng-wàahn', ' Jūng  Wàahn. ']) expect(checkYale(typed, CEN).ok).toBe(true);
  });
  it('says which syllable has the wrong tone when only tones are off', () => {
    const r = checkYale('jung wàahn', CEN);
    expect(r).toMatchObject({ ok: false, tones: true });
    expect(r.parts).toEqual([{ syl: 'Jūng', right: false }, { syl: 'wàahn', right: true }]);
  });
  it('rejects wrong letters without a tones hint', () => expect(checkYale('jung waan', CEN)).toEqual({ ok: false }));
  it('notices an empty answer', () => expect(checkYale(' ', CEN)).toEqual({ ok: false, empty: true }));
});

describe('typing tones with numbers (yau4 → yàuh)', () => {
  const cases: [string, number, string][] = [
    ['yau', 4, 'yàuh'], ['hou', 2, 'hóu'], ['sik', 1, 'sīk'], ['baat', 3, 'baat'], ['leung', 5, 'léuhng'],
    ['gwong', 2, 'gwóng'], ['sai', 6, 'saih'], ['m', 4, 'm̀'], ['ng', 5, 'ńgh'],
  ];
  for (const [w, t, want] of cases) it(`${w}${t} → ${want}`, () => expect(retone(w, t)).toBe(want.normalize('NFC')));
});
