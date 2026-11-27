// Canto Numbers' side of the reader's romanisation choice (Yale or Jyutping, shared with the whole arcade).
// The game's answers stay in Yale; Jyutping readers see and type the Jyutping of the same answers.
import { getRomanisation, parseYale, rom as romAll, syllableToJyutping, yaleWordToJyutping } from '../../../src/shared/romanisation';
import type { YaleVerdict } from './yale/check';

export const JP = getRomanisation() === 'jyutping';
export const ROM_NAME = JP ? 'jyutping' : 'yale';

/** Yale text (an answer, an example line) in the reader's romanisation. */
export const rom = (yale: string) => romAll(yale);

/** An answer in the reader's romanisation, one word per syllable group as the game shows it. */
export function answerKey(yale: string, jp = JP): string {
  if (!jp) return yale;
  return yale.split(/\s+/).map((w) => yaleWordToJyutping(w) ?? w).join(' ');
}

/** A syllable tile's label: the toneless Yale base, or its Jyutping letters. */
export function tileLabel(base: string): string {
  if (!JP) return base;
  const p = parseYale(base);
  return p ? syllableToJyutping(p).replace(/\d$/, '') : base;
}

/** Lenient Jyutping check against the accepted Yale answers: case, spaces and hyphens never matter. */
export function checkJyutping(input: string, accepted: string[]): YaleVerdict {
  const n = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!n) return 'wrong';
  const keys = accepted.map((a) => answerKey(a, true).replace(/[^a-z0-9]/g, ''));
  if (keys.includes(n)) return 'correct';
  const bare = (s: string) => s.replace(/\d/g, '');
  if (keys.some((k) => bare(k) === bare(n))) return 'tone';
  return 'wrong';
}
