import { describe, expect, it } from 'vitest';
import { answerKey, checkJyutping } from './rom';

describe('Jyutping answers for Yale numbers', () => {
  it('converts accepted answers', () => {
    expect(answerKey('sāam sahp baat', true)).toBe('saam1 sap6 baat3');
    expect(answerKey('sā-ah baat', true)).toBe('saa1 aa6 baat3');
    expect(answerKey('léuhng mān', true)).toBe('loeng5 man1');
  });
  it('checks leniently: case, spaces and hyphens never matter', () => {
    expect(checkJyutping('saam1sap6baat3', ['sāam sahp baat'])).toBe('correct');
    expect(checkJyutping('SAAM1 SAP6 BAAT3', ['sāam sahp baat'])).toBe('correct');
    expect(checkJyutping('saa1-aa6 baat3', ['sā-ah baat'])).toBe('correct');
  });
  it('tells a tone slip from a wrong answer', () => {
    expect(checkJyutping('saam1 sap1 baat3', ['sāam sahp baat'])).toBe('tone');
    expect(checkJyutping('sei3 sap6 baat3', ['sāam sahp baat'])).toBe('wrong');
  });
});
