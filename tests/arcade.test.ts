import { describe, expect, it } from 'vitest';
import { FRONT_Y, MACHINES, machineAt, playable } from '../src/logic/machines';
import { hkMapMet, numbersBest, parseArcade, progressLine, recordVisit } from '../src/logic/progress';

describe('machines', () => {
  it('finds the machine you stand in front of', () => {
    expect(machineAt(104, FRONT_Y)?.id).toBe('hk-map');
    expect(machineAt(172 + 8, FRONT_Y + 6)?.id).toBe('canto-numbers');
  });
  it('finds nothing in the middle of the room', () => {
    expect(machineAt(240, 230)).toBeNull();
  });
  it('only real games are playable', () => {
    expect(MACHINES.filter((m) => playable(m)).map((m) => m.id)).toEqual(['hk-map', 'canto-numbers']);
  });
  it('cabinets do not overlap', () => {
    const xs = MACHINES.map((m) => m.x).sort((a, b) => a - b);
    xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(40));
  });
});

describe('saves', () => {
  it('survives a missing or broken arcade save', () => {
    expect(parseArcade(null)).toEqual({ last: null, visits: {} });
    expect(parseArcade('{nope')).toEqual({ last: null, visits: {} });
  });
  it('remembers the last machine and counts visits', () => {
    const s = recordVisit(recordVisit(parseArcade(null), 'hk-map'), 'hk-map');
    expect(s).toEqual({ last: 'hk-map', visits: { 'hk-map': 2 } });
  });
  it('reads 香港通 progress: places met', () => {
    expect(hkMapMet(JSON.stringify({ items: { 'S:ADM': { s: '2026-11-01' }, 'S:JOR': { l: 1 }, 'D:灣仔': { s: 'x' } } }))).toBe(2);
    expect(hkMapMet(null)).toBeNull();
  });
  it('reads the Canto Numbers best score', () => {
    expect(numbersBest(JSON.stringify({ best: { 'read-1': 120, 'listen-3': 340 } }))).toBe(340);
    expect(numbersBest(JSON.stringify({ best: {} }))).toBeNull();
  });
  it('shows a progress line only when there is progress', () => {
    const store: Record<string, string> = { 'hkmapgame-v3': JSON.stringify({ items: { a: { s: 1 } } }) };
    expect(progressLine('hk-map', (k) => store[k] ?? null)).toBe('見過 1/244');
    expect(progressLine('canto-numbers', (k) => store[k] ?? null)).toBeNull();
  });
});
