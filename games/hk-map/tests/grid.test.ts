import { describe, expect, it } from 'vitest';
import { CHUNK, Grid, cellOf, chunksFor } from '../src/overworld/grid';
import { T, isStreet, walkable } from '../src/overworld/terrain';

/** a little world from rows of letters: ~ sea, . grass, u urban, r road, c china */
function world(rows: string[]) {
  const M: Record<string, number> = { '~': T.sea, '.': T.grass, u: T.urban, r: T.road, c: T.china, w: T.wood };
  const h = rows.length, w = rows[0].length, cells = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { cells[y * w + x] = M[ch]; }));
  return new Grid(w, h, cells);
}

describe('what you can walk on', () => {
  it('water and the mainland block; grass, woods and roads do not', () => {
    for (const c of [T.deep, T.sea, T.shore, T.reservoir, T.pond, T.china]) expect(walkable(c, 1, 1)).toBe(false);
    for (const c of [T.grass, T.wood, T.scrub, T.top, T.park, T.road, T.motorway, T.bridge, T.pier, T.sand]) expect(walkable(c, 1, 1)).toBe(true);
  });
  it('in town, streets on the block grid are walkable and the buildings between them are not', () => {
    expect(isStreet(T.urban, 4, 1)).toBe(true);
    expect(isStreet(T.urban, 1, 5)).toBe(true);
    expect(walkable(T.urban, 1, 1)).toBe(false);
    expect(walkable(T.urban, 1, 1, true)).toBe(true); // pavement along a road
  });
});

describe('stepping', () => {
  const g = world(['~~~~~', '~...~', '~.c.~', '~~~~~']);
  it('moves one cell onto open ground', () => expect(g.step(1, 1, 'right')).toEqual([2, 1]));
  it('the sea blocks', () => expect(g.step(1, 1, 'up')).toBeNull());
  it('the mainland blocks', () => expect(g.step(1, 2, 'right')).toBeNull());
  it('outside the map is deep sea', () => expect(g.at(-1, 0)).toBe(T.deep));
});

describe('tap-to-walk paths', () => {
  const g = world(['.....', '.~~~.', '.~.~.', '.....']);
  it('walks around water', () => {
    const p = g.path(0, 2, 4, 2)!;
    expect(p.length).toBe(6);
    let x = 0, y = 2; for (const d of p) { const s = g.step(x, y, d)!; expect(s).not.toBeNull(); [x, y] = s; }
    expect([x, y]).toEqual([4, 2]);
  });
  it('gives up on an island you cannot reach', () => expect(world(['.....', '.~~~.', '.~.~.', '.~~~.', '.....']).path(0, 0, 2, 2)).toBeNull());
  it('an empty path when already there', () => expect(g.path(1, 0, 1, 0)).toEqual([]));
});

describe('placing things', () => {
  it('finds the nearest cell you can stand on', () => expect(world(['~~~', '~~.']).nearestStandable(0, 0)).toEqual([2, 1]));
  it('old map units are two cells each', () => expect(cellOf(526.3, 409.9)).toEqual([1052, 819]));
  it('chunks cover the view plus a margin', () => {
    const ks = chunksFor(0, 0, CHUNK - 1, CHUNK - 1, 1);
    expect(ks).toHaveLength(9);
    expect(ks).toContain('-1,-1');
    expect(ks).toContain('1,1');
  });
});
