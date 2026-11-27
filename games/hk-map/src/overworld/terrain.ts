// The open world's terrain classes: one per 30 m cell, in public/img/world.png (built by build/world.py,
// whose CLASSES list this mirrors — same order, same numbers). No Phaser here: pure rules, unit-tested.

export const T = {
  deep: 0, sea: 1, shore: 2, sand: 3, grass: 4, wood: 5, scrub: 6, top: 7, farm: 8, urban: 9, industrial: 10,
  park: 11, airport: 12, runway: 13, motorway: 14, road: 15, reservoir: 16, pond: 17, china: 18, bridge: 19, pier: 20, containers: 21,
} as const;
export type Terrain = (typeof T)[keyof typeof T];

/** metres per cell, cells per world unit (the old map's 60 m units) */
export const CELL_M = 30;
export const CELLS_PER_UNIT = 2;
/** pixels per cell in the tile art */
export const TILE = 16;

const WATER: ReadonlySet<number> = new Set([T.deep, T.sea, T.shore, T.reservoir, T.pond]);
export const isWater = (c: number) => WATER.has(c);

/** Built-up ground: drawn as blocks of buildings with streets between them. */
export const isBuilt = (c: number) => c === T.urban || c === T.industrial;

/**
 * Streets inside built-up areas run on a fixed world grid, so blocks line up across the map:
 * a street every BLOCK_W cells across and every BLOCK_H cells down (urban), wider blocks for industry.
 */
export function isStreet(c: number, x: number, y: number): boolean {
  if (c === T.urban) return x % 4 === 0 || y % 5 === 0;
  if (c === T.industrial) return x % 7 === 0 || y % 6 === 0;
  return false;
}

/**
 * Can you stand on this cell? Water, mainland China (beyond the border) and buildings block;
 * container stacks block except the lanes between them. Streets, roads, bridges, piers and all
 * open ground are walkable. `next(dx, dy)` reads a neighbouring cell's class.
 */
export function walkable(c: number, x: number, y: number, roadNear = false): boolean {
  if (isWater(c) || c === T.china) return false;
  if (isBuilt(c)) return roadNear || isStreet(c, x, y);
  if (c === T.containers) return y % 3 === 0;
  return true;
}

export type Dir = 'up' | 'down' | 'left' | 'right';
export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
