import { describe, expect, it } from 'vitest';
import { type MapItem, markSent, mastered, readyForAnki, suspendedCardsQuery, today } from '../src/logic/hkmapAnki';
import { mergeArcade, mergeMapSaves, mergeNumbers, publicMap } from '../src/logic/sync';

const ITEMS: MapItem[] = [
  ['S:JOR', 's', 'tag:mtr::JOR'],
  ['L:TWL', 'l', 'tag:mtr::TWL'],
  ['C:2497', 'c', 'tag:hkmap::C-2497'],
];

describe('which 香港通 places go to Anki', () => {
  it('uses the map game rules', () => {
    expect(mastered('s', { l: 2, y: 2, days: ['a', 'b'] })).toBe(true);
    expect(mastered('s', { l: 2, y: 2, days: ['a'] })).toBe(false);   // only one day
    expect(mastered('l', { l: 0, y: 3, days: ['a', 'b'] })).toBe(true); // lines: typed 3 times
    expect(mastered('l', { l: 5, y: 2, days: ['a', 'b'] })).toBe(false);
    expect(mastered('c', { m: 1 })).toBe(true);                         // ticked as known
    expect(mastered('c', undefined)).toBe(false);
  });
  it('sends learned places once', () => {
    const save = { items: { 'S:JOR': { l: 2, y: 2, days: [1, 2] }, 'C:2497': { m: 1 }, 'L:TWL': { y: 1 } }, sent: { 'C:2497': '2026-11-20' } };
    expect(readyForAnki(ITEMS, save).map((i) => i[0])).toEqual(['S:JOR']);
    const after = markSent(save, ['S:JOR'], '2026-11-27', 5);
    expect(readyForAnki(ITEMS, after)).toEqual([]);
    expect(after.updated).toBe(5);
  });
  it('only ever touches suspended cards', () => {
    expect(suspendedCardsQuery(ITEMS[0])).toBe('(tag:mtr::JOR) is:suspended');
  });
  it('dates days in local time', () => {
    expect(today(new Date(2026, 10, 27, 23, 30))).toBe('2026-11-27');
  });
});

describe('sync between devices', () => {
  it('combines 香港通 saves like the map game does, keeping this device’s settings', () => {
    const mac = { items: { a: { l: 3, days: ['d1'] } }, missions: { x: 1 }, updated: 10, settings: { key: 'SECRET' } };
    const phone = { items: { a: { l: 1, days: ['d2'] }, b: { s: 'd2' } }, missions: { y: 1 }, updated: 20 };
    const m = mergeMapSaves(mac, phone);
    expect(m.items).toEqual({ a: { l: 3, days: ['d1', 'd2'] }, b: { s: 'd2' } });
    expect(m.missions).toEqual({ y: 1 }); // newer wins
    expect(m.updated).toBe(20);
    expect(m.settings).toEqual({ key: 'SECRET' });
  });
  it('never uploads device settings (they hold the Azure key)', () => {
    expect(publicMap({ items: {}, settings: { key: 'SECRET' } })).toEqual({ items: {} });
  });
  it('keeps the best Canto Numbers score from either device', () => {
    const m = mergeNumbers({ best: { 'read-1': 120 }, muted: true, name: '' }, { best: { 'read-1': 90, 'listen-2': 300 }, muted: false, name: 'Joseph' });
    expect(m).toEqual({ best: { 'read-1': 120, 'listen-2': 300 }, muted: true, name: 'Joseph' });
  });
  it('adds up arcade visits but keeps where you stand', () => {
    expect(mergeArcade({ last: 'hk-map', visits: { 'hk-map': 3 } }, { last: 'canto-numbers', visits: { 'hk-map': 5, 'canto-numbers': 1 } }))
      .toEqual({ last: 'hk-map', visits: { 'hk-map': 5, 'canto-numbers': 1 } });
  });
});
