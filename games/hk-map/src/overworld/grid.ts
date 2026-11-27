// The world grid: terrain per cell, walkability, steps and short paths. No Phaser here.
import { CELLS_PER_UNIT, DIRS, T, walkable, type Dir } from './terrain';

export const CHUNK = 32; // cells per chunk side (512 px of tile art)

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;

  constructor(w: number, h: number, cells: Uint8Array) {
    if (cells.length !== w * h) throw new Error(`grid ${w}×${h} needs ${w * h} cells, got ${cells.length}`);
    this.w = w; this.h = h; this.cells = cells;
  }

  inside(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  /** the class at a cell; outside the map is deep sea */
  at(x: number, y: number): number { return this.inside(x, y) ? this.cells[y * this.w + x] : T.deep; }

  /** next to a road or motorway (the cells along a road in town are pavement, not buildings) */
  roadNear(x: number, y: number) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = this.at(x + dx, y + dy); if (c === T.road || c === T.motorway) return true; }
    return false;
  }

  canStand(x: number, y: number) { return this.inside(x, y) && walkable(this.at(x, y), x, y, this.roadNear(x, y)); }

  /** where one step in `dir` from (x, y) lands, or null if it's blocked */
  step(x: number, y: number, dir: Dir): [number, number] | null {
    const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy;
    return this.canStand(nx, ny) ? [nx, ny] : null;
  }

  /** the nearest cell you can stand on (spiralling out), for placing the player and landmarks' doorsteps */
  nearestStandable(x: number, y: number, max = 12): [number, number] | null {
    if (this.canStand(x, y)) return [x, y];
    for (let r = 1; r <= max; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (this.canStand(x + dx, y + dy)) return [x + dx, y + dy];
    }
    return null;
  }

  /**
   * The shortest walk from a to b as a list of steps (breadth-first, 4 directions), or null if b can't be
   * reached within `limit` cells of a. Used for tap-to-walk.
   */
  path(ax: number, ay: number, bx: number, by: number, limit = 40): Dir[] | null {
    if (!this.canStand(bx, by)) return null;
    if (ax === bx && ay === by) return [];
    const key = (x: number, y: number) => (y - ay + limit) * (2 * limit + 1) + (x - ax + limit);
    const prev = new Map<number, [number, Dir]>(), q: [number, number][] = [[ax, ay]];
    prev.set(key(ax, ay), [-1, 'up']);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const d of Object.keys(DIRS) as Dir[]) {
        const s = this.step(x, y, d); if (!s) continue; const [nx, ny] = s;
        if (Math.abs(nx - ax) > limit || Math.abs(ny - ay) > limit) continue;
        const k = key(nx, ny); if (prev.has(k)) continue;
        prev.set(k, [key(x, y), d]);
        if (nx === bx && ny === by) {
          const out: Dir[] = []; let c = k;
          while (true) { const [p, dd] = prev.get(c)!; if (p < 0) break; out.unshift(dd); c = p; }
          return out;
        }
        q.push([nx, ny]);
      }
    }
    return null;
  }
}

/** the cell under a point given in the old map's world units (items' x, y) */
export const cellOf = (x: number, y: number): [number, number] => [Math.floor(x * CELLS_PER_UNIT), Math.floor(y * CELLS_PER_UNIT)];

/** chunk keys ("cx,cy") covering a view of cells, plus `margin` chunks around it */
export function chunksFor(x0: number, y0: number, x1: number, y1: number, margin = 1): string[] {
  const out: string[] = [];
  for (let cy = Math.floor(y0 / CHUNK) - margin; cy <= Math.floor(y1 / CHUNK) + margin; cy++)
    for (let cx = Math.floor(x0 / CHUNK) - margin; cx <= Math.floor(x1 / CHUNK) + margin; cx++) out.push(cx + ',' + cy);
  return out;
}
