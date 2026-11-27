import { describe, expect, it } from 'vitest';
import { checkJyutping, parseYale, rom, splitYaleWord, syllableToJyutping, yaleTextToJyutping, yaleWordToJyutping } from '../src/shared/romanisation';

const jp = (s: string) => syllableToJyutping(parseYale(s)!);

describe('Yale syllable → Jyutping', () => {
  it('tones from the marks and the low-register h', () => {
    expect(['sī', 'sí', 'si', 'sìh', 'síh', 'sih'].map(jp)).toEqual(['si1', 'si2', 'si3', 'si4', 'si5', 'si6']);
    expect(jp('sì')).toBe('si1'); // the high falling tone is tone 1
  });
  it('initials: j → z, ch → c, y → j', () => {
    expect(jp('Jūng')).toBe('zung1');
    expect(jp('chē')).toBe('ce1');
    expect(jp('yāt')).toBe('jat1');
  });
  it('y + u: the yu- final when there is one, else u-', () => {
    expect(jp('yùh')).toBe('jyu4'); // 魚
    expect(jp('yuht')).toBe('jyut6'); // 月
    expect(jp('yúhn')).toBe('jyun5'); // 遠
    expect(jp('yuhk')).toBe('juk6'); // 玉
    expect(jp('yuhng')).toBe('jung6'); // 用
  });
  it('finals that change: open a, eu, eui, eun, eung, euk, eut', () => {
    expect(jp('sā')).toBe('saa1');
    expect(jp('hēu')).toBe('hoe1');
    expect(jp('kéuih')).toBe('keoi5');
    expect(jp('chēun')).toBe('ceon1');
    expect(jp('Hēung')).toBe('hoeng1');
    expect(jp('jeuk')).toBe('zoek3');
    expect(jp('chēut')).toBe('ceot1');
  });
  it('yu finals after any initial', () => {
    expect(jp('syū')).toBe('syu1');
    expect(jp('Chyùhn')).toBe('cyun4');
    expect(jp('jyut')).toBe('zyut3');
  });
  it('syllabic nasals', () => {
    expect(jp('m̀h')).toBe('m4');
    expect(jp('ńgh')).toBe('ng5');
  });
  it('rejects what is not Yale', () => {
    for (const s of ['level', 'xin', 'wōh', 'qa', 'anki']) expect(parseYale(s)).toBeNull();
  });
});

describe('words and text', () => {
  it('splits run-together syllables the way Yale writes them', () => {
    expect(splitYaleWord('Sātìhn')).toEqual(['Sā', 'tìhn']);
    expect(splitYaleWord('lùhngwāan')).toEqual(['lùhng', 'wāan']);
    expect(splitYaleWord('Gūngyún')).toEqual(['Gūng', 'yún']);
    expect(splitYaleWord('Chyùhnwāan')).toEqual(['Chyùhn', 'wāan']);
  });
  it('converts words, apostrophes and all', () => {
    expect(yaleWordToJyutping("Jūng'wàahn")).toBe('zung1 waan4');
    expect(yaleWordToJyutping('Gwóngdūngwá')).toBe('gwong2 dung1 waa2');
  });
  it('converts Yale in mixed text, keeps English and Chinese', () => {
    expect(yaleTextToJyutping('香港通 Hēunggóng Tūng · learn places')).toBe('香港通 hoeng1 gong2 tung1 · learn places');
    expect(yaleTextToJyutping('Level 3')).toBe('Level 3');
  });
  it('rom() follows the chosen romanisation', () => {
    expect(rom('Gēipou', 'yale')).toBe('Gēipou');
    expect(rom('Gēipou', 'jyutping')).toBe('gei1 pou3');
  });
});

describe('checking a Jyutping answer (lenient)', () => {
  const syl = ['Jūng', 'wàahn'];
  it('accepts with or without spaces, any case', () => {
    for (const t of ['zung1 waan4', 'ZUNG1WAAN4', 'zung1-waan4']) expect(checkJyutping(t, syl).ok).toBe(true);
  });
  it('a tones-only miss names the syllable', () => {
    expect(checkJyutping('zung1 waan2', syl)).toEqual({ ok: false, tones: true, parts: [{ syl: 'zung1', right: true }, { syl: 'waan4', right: false }] });
  });
  it('wrong letters, or nothing typed', () => {
    expect(checkJyutping('zong1 waan4', syl)).toEqual({ ok: false });
    expect(checkJyutping('  ', syl)).toEqual({ ok: false, empty: true });
  });
});
