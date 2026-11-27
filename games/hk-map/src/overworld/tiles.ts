// The open world's tile art, painted pixel by pixel into a chunk (CHUNK×CHUNK cells, TILE px each).
// No Phaser and no DOM: it fills an RGBA buffer, so it runs anywhere and can be tested.
//
// Two passes per chunk:
// 1. which terrain each *pixel* shows. Cells are rounded RPG Maker-style per quarter tile: a quarter whose
//    two outer sides face lower ground (water below sand below ground below woods) is cut to a quarter
//    circle; a quarter whose only lower neighbour is diagonal gets a small notch. Coasts, woods and fields
//    come out as smooth shapes instead of staircases.
// 2. the colour of each pixel: seamless patterns in world pixel coordinates (so forests and fields do not
//    repeat per cell), coast edges and foam, connected roads, and town cells as blocks of buildings.
import { CHUNK, type Grid } from './grid';
import { T, TILE, isBuilt, isStreet, isWater } from './terrain';

const isRoadish = (c: number) => c === T.road || c === T.motorway || c === T.bridge;

type RGB = readonly [number, number, number];

/** drawing height of each class: rounding only ever reveals a lower neighbour */
const LAYER: Record<number, number> = {
  [T.deep]: -1, [T.sea]: 0, [T.shore]: 0, [T.reservoir]: 0, [T.pond]: 0,
  [T.sand]: 1, [T.china]: 1,
  [T.grass]: 2, [T.scrub]: 2, [T.top]: 2, [T.farm]: 2, [T.park]: 2, [T.airport]: 2,
  [T.wood]: 3,
};
/** classes drawn with straight edges (man-made) */
const SQUARE = new Set<number>([T.urban, T.industrial, T.road, T.motorway, T.bridge, T.pier, T.runway, T.containers]);
const layer = (c: number) => LAYER[c] ?? 4;

/** a small, stable hash of a few integers → 0..1 */
export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The terrain a given pixel of cell (x, y) shows, with the quarter-tile rounding. */
export function pixelClass(g: Grid, x: number, y: number, px: number, py: number): number {
  const c = g.at(x, y);
  const qx = px < TILE / 2 ? -1 : 1, qy = py < TILE / 2 ? -1 : 1;
  // distances from this quarter's outer corner, in pixels (0 = the cell's edge)
  const dx = qx < 0 ? px : TILE - 1 - px, dy = qy < 0 ? py : TILE - 1 - py;
  const H = g.at(x + qx, y), V = g.at(x, y + qy), D = g.at(x + qx, y + qy);
  // a road turning diagonally: fill the inside of the corner, so diagonal roads run at 45° instead of in steps
  if (!isRoadish(c) && isRoadish(H) && isRoadish(V) && !isWater(c) && dx + dy < TILE / 2) return H === V ? H : T.road;
  if (SQUARE.has(c)) return c;
  const L = layer(c);
  if (L < 0) return c;
  const lowH = layer(H) < L && !SQUARE.has(H), lowV = layer(V) < L && !SQUARE.has(V), lowD = layer(D) < L && !SQUARE.has(D);
  const R = TILE / 2;
  if (lowH && lowV) {
    const ex = dx + 0.5 - R, ey = dy + 0.5 - R;
    return ex * ex + ey * ey <= R * R ? c : (layer(H) <= layer(V) ? H : V);
  }
  if (lowD && !lowH && !lowV) {
    const ex = dx + 0.5, ey = dy + 0.5;
    return ex * ex + ey * ey < 9 ? D : c;
  }
  return c;
}

const COL = {
  deep: [52, 98, 143], wave: [86, 134, 178], sea: [70, 122, 170], foam: [226, 240, 244],
  res: [112, 168, 210], resE: [92, 146, 190], pond: [96, 150, 146],
  sand: [240, 226, 166], sandD: [224, 204, 140], edge: [206, 188, 140], rock: [170, 160, 140],
  grass: [150, 186, 108], grassD: [126, 164, 90], grassL: [170, 202, 124],
  scrub: [132, 168, 94], scrubD: [108, 146, 78], top: [172, 178, 118], topD: [150, 150, 136],
  farm1: [184, 200, 124], farm2: [198, 196, 134], farmE: [140, 170, 96],
  park: [172, 208, 138], parkT: [112, 160, 86], parkTD: [86, 130, 66],
  woodGap: [62, 102, 52], woodL: [118, 166, 86], woodM: [96, 146, 72], woodD: [74, 118, 58],
  china: [208, 202, 184], chinaH: [196, 190, 172],
  pave: [214, 206, 194], paveD: [196, 188, 176], kerb: [236, 230, 220],
  tarmac: [150, 146, 146], tarmacE: [120, 116, 118], line: [240, 236, 226],
  motor: [118, 112, 116], motorE: [96, 90, 96], motorLine: [236, 196, 92],
  bridge: [214, 210, 200], rail: [140, 134, 126], pier: [178, 140, 96], pierD: [140, 106, 70],
  apron: [204, 204, 198], apronL: [226, 222, 140], runway: [92, 94, 100], runwayL: [244, 244, 236],
  shadow: [0, 0, 0],
} satisfies Record<string, RGB>;

const ROOFS: RGB[] = [[236, 228, 214], [222, 206, 180], [210, 180, 160], [190, 190, 196], [226, 216, 176], [204, 196, 214], [182, 168, 156]];
const CONTAINERS: RGB[] = [[196, 66, 54], [52, 104, 168], [58, 140, 92], [222, 140, 52], [150, 150, 156], [168, 52, 110]];

/** One building per town block: which block a town cell belongs to (streets are block 0). */
function blockOf(g: Grid, x: number, y: number): number {
  const c = g.at(x, y);
  if (!isBuilt(c) || isStreet(c, x, y) || g.roadNear(x, y)) return 0;
  return c === T.urban ? 1 + Math.floor(x / 4) * 7919 + Math.floor(y / 5) * 104729 : 2 + Math.floor(x / 7) * 7919 + Math.floor(y / 6) * 104729;
}


/**
 * Paint chunk (cx, cy) into `out` (RGBA, (CHUNK*TILE)² pixels). Returns `out`.
 */
export function paintChunk(g: Grid, cx: number, cy: number, out?: Uint8ClampedArray): Uint8ClampedArray {
  const S = CHUNK * TILE, x0 = cx * CHUNK, y0 = cy * CHUNK, B = S + 2;
  const buf = out ?? new Uint8ClampedArray(S * S * 4);
  // pass 1: the class of every pixel, with a 1-pixel border for edge detection
  const pc = new Uint8Array(B * B);
  // cell by cell (with the ring of cells around the chunk): a cell whose 8 neighbours are all its own class
  // is filled at once; only cells on a boundary are decided pixel by pixel
  for (let cyl = y0 - 1; cyl <= y0 + CHUNK; cyl++) for (let cxl = x0 - 1; cxl <= x0 + CHUNK; cxl++) {
    const c = g.at(cxl, cyl);
    let uniform = true;
    for (let oy = -1; oy <= 1 && uniform; oy++) for (let ox = -1; ox <= 1; ox++) if (g.at(cxl + ox, cyl + oy) !== c) { uniform = false; break; }
    const bi = (cxl - x0) * TILE + 1, bj = (cyl - y0) * TILE + 1; // this cell's top-left in the buffer
    for (let py = 0; py < TILE; py++) {
      const j = bj + py; if (j < 0 || j >= B) continue;
      for (let px = 0; px < TILE; px++) {
        const i = bi + px; if (i < 0 || i >= B) continue;
        pc[j * B + i] = uniform ? c : pixelClass(g, cxl, cyl, px, py);
      }
    }
  }
  const P = (i: number, j: number) => pc[(j + 1) * B + (i + 1)];
  // pass 2: colours
  const n4 = [0, 0, 0, 0];
  for (let j = 0; j < S; j++) {
    const gy = y0 * TILE + j, cyl = y0 + (j >> 4), py = j & 15;
    for (let i = 0; i < S; i++) {
      const gx = x0 * TILE + i, cxl = x0 + (i >> 4), px = i & 15;
      const c = P(i, j);
      n4[0] = P(i - 1, j); n4[1] = P(i + 1, j); n4[2] = P(i, j - 1); n4[3] = P(i, j + 1);
      const col = colour(g, c, cxl, cyl, px, py, gx, gy, n4);
      const o = (j * S + i) * 4;
      buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255;
    }
  }
  return buf;
}

function colour(g: Grid, c: number, x: number, y: number, px: number, py: number, gx: number, gy: number, n4: number[]): RGB {
  const water = isWater(c);
  if (water) {
    if (n4.some((n) => !isWater(n))) return c === T.reservoir ? COL.resE : COL.foam;
    if (c === T.reservoir) return COL.res;
    if (c === T.pond) return (gx % 8 === 0 || gy % 6 === 0) ? COL.grassD : COL.pond;
    const nearCoast = c !== T.deep;
    return WAVES(gx, gy) ? COL.wave : nearCoast ? COL.sea : COL.deep;
  }
  // the coast: a light edge on land along the water
  if (n4.some(isWater) && !isRoadish(c) && c !== T.pier) return c === T.sand ? COL.sandD : c === T.china ? COL.chinaH : COL.edge;

  switch (c) {
    case T.sand: return hash(gx, gy, 1) < 0.08 ? COL.sandD : COL.sand;
    case T.china: return (gx + gy) % 6 === 0 ? COL.chinaH : COL.china;
    case T.grass: return GRASS(gx, gy);
    case T.scrub: return SCRUB(gx, gy);
    case T.top: return hash(gx >> 1, gy >> 1, 5) < 0.06 ? COL.topD : COL.top;
    case T.farm: { const fx = Math.floor(gx / 32), fy = Math.floor(gy / 24); if (gx % 32 === 0 || gy % 24 === 0) return COL.farmE; return (hash(fx, fy, 6) < 0.5 ? (gy % 4 < 2) : (gx % 4 < 2)) ? COL.farm1 : COL.farm2; }
    case T.park: return PARK(gx, gy);
    case T.wood: return WOOD(gx, gy);
    case T.airport: return (gx % 64 === 0 && gy % 2 === 0) ? COL.apronL : COL.apron;
    case T.runway: return (gy % 16 === 8 && (gx >> 3) % 2 === 0) ? COL.runwayL : (gy % 16 === 0 ? COL.apron : COL.runway);
    case T.pier: return py % 4 === 0 ? COL.pierD : COL.pier;
    case T.containers: {
      if (y % 3 === 0) return COL.tarmac;
      const k = CONTAINERS[Math.floor(hash(x >> 1, Math.floor(y / 3), 7) * CONTAINERS.length)];
      return px % 8 === 0 || py === 15 ? shade(k, 0.7) : k;
    }
    case T.road: case T.motorway: case T.bridge:
      // a corner filled by a diagonal road: plain surface, no kerbs
      if (!isRoadish(g.at(x, y))) return c === T.bridge ? COL.bridge : c === T.motorway ? COL.motor : COL.tarmac;
      return road(g, c, x, y, px, py);
    case T.urban: case T.industrial: return town(g, c, x, y, px, py, gx, gy);
  }
  return COL.grass;
}

const shade = (k: RGB, f: number): RGB => [Math.round(k[0] * f), Math.round(k[1] * f), Math.round(k[2] * f)];

function tufts(gx: number, gy: number, base: RGB, dark: RGB, light: RGB): RGB {
  const lx = gx >> 2, ly = gy >> 2, h = hash(lx & 15, ly & 15, 2), tx = lx * 4 + Math.floor(h * 3), ty = ly * 4 + Math.floor(hash(lx & 15, ly & 15, 9) * 3);
  if (h < 0.18 && gx === tx && (gy === ty || gy === ty + 1)) return gy === ty ? light : dark;
  return base;
}

/** round bushes/trees on a jittered lattice (`step` px apart, radius r), shaded light top-left, dark bottom-right */
function bushes(gx: number, gy: number, base: RGB, leaf: RGB, step: number, r: number, dark?: RGB): RGB {
  const lx = Math.floor(gx / step), ly = Math.floor(gy / step);
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const ax = lx + ox, ay = ly + oy, hx = ax & 7, hy = ay & 7; if (hash(hx, hy, 11) < 0.45) continue;
    const cx = ax * step + step / 2 + (hash(hx, hy, 12) - 0.5) * step * 0.5, cy = ay * step + step / 2 + (hash(hx, hy, 13) - 0.5) * step * 0.5;
    const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 <= r * r) return dark && dx + dy > r * 0.6 ? dark : leaf;
  }
  return base;
}

/** dense woods: overlapping round crowns, each shaded, dark gaps between */
function trees(gx: number, gy: number): RGB {
  const step = 7, lx = Math.floor(gx / step), ly = Math.floor(gy / step);
  let best = 1e9, bx = 0, by = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const ax = lx + ox, ay = ly + oy, hx = ax & 7, hy = ay & 7;
    const cx = ax * step + 3.5 + (hash(hx, hy, 21) - 0.5) * 4, cy = ay * step + 3.5 + (hash(hx, hy, 22) - 0.5) * 4;
    const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 < best) { best = d2; bx = dx; by = dy; }
  }
  if (best > 4.6 * 4.6) return COL.woodGap;
  if (bx + by < -2.5) return COL.woodL;
  if (bx + by > 2.5) return COL.woodD;
  return COL.woodM;
}

/** roads join their neighbours: kerbs where the road ends, a centre line along straight runs */
function road(g: Grid, c: number, x: number, y: number, px: number, py: number): RGB {
  const same = (dx: number, dy: number) => isRoadish(g.at(x + dx, y + dy));
  const L = same(-1, 0), Rr = same(1, 0), U = same(0, -1), D = same(0, 1);
  const motor = c === T.motorway, base = c === T.bridge ? COL.bridge : motor ? COL.motor : COL.tarmac, edge = c === T.bridge ? COL.rail : motor ? COL.motorE : COL.tarmacE;
  if ((!L && px === 0) || (!Rr && px === 15) || (!U && py === 0) || (!D && py === 15)) return edge;
  const line = motor ? COL.motorLine : COL.line;
  if (L && Rr && !U && !D && py === 8 && (px >> 2) % 2 === 0) return line;
  if (U && D && !L && !Rr && px === 8 && (py >> 2) % 2 === 0) return line;
  return base;
}

/** town: pavements on the street grid and along roads, buildings filling each block */
function town(g: Grid, c: number, x: number, y: number, px: number, py: number, gx: number, gy: number): RGB {
  const b = blockOf(g, x, y);
  if (!b) return (px === 0 || py === 0) ? COL.kerb : (px === 8 || py === 8) ? COL.paveD : COL.pave; // paving slabs
  const roof = c === T.industrial ? (py % 3 === 0 ? [186, 178, 188] as RGB : [206, 198, 204] as RGB) : ROOFS[Math.floor(hash(b, 0, 31) * ROOFS.length)];
  const nb = (dx: number, dy: number) => blockOf(g, x + dx, y + dy) === b;
  // a dark outline at the block's edge, a shadow along its bottom and right inside the pavement
  if ((!nb(-1, 0) && px === 0) || (!nb(0, -1) && py === 0)) return shade(roof, 0.62);
  if ((!nb(1, 0) && px >= 14) || (!nb(0, 1) && py >= 14)) return shade(roof, (px === 15 || py === 15) ? 0.5 : 0.62);
  if (c === T.urban) {
    // rooftop details: a water tank or a lift room on some cells, light ridge lines on taller blocks
    const h = hash(x, y, 33);
    if (h < 0.22 && px >= 4 && px <= 7 && py >= 4 && py <= 6) return py === 6 ? shade(roof, 0.75) : [150, 156, 168];
    if (hash(b, 1, 34) < 0.3 && gy % 4 === 0) return shade(roof, 0.92); // ridged roofs on some blocks
  }
  return roof as RGB;
}

/** waves: short dashes on a loose lattice (24×18 px cells), two pixels up in the middle */
function wave(gx: number, gy: number): boolean {
  const lx = Math.floor(gx / 24), ly = Math.floor(gy / 18), h = hash(lx & 7, ly & 7, 3);
  const wx = lx * 24 + Math.floor(h * 14), wy = ly * 18 + Math.floor(hash(lx & 7, ly & 7, 4) * 12), dx = gx - wx, dy = gy - wy;
  return h > 0.45 && dx >= 0 && dx < 5 && (dy === 0 && (dx === 0 || dx === 4) || dy === -1 && dx > 0 && dx < 4);
}

/**
 * The patterns repeat (their lattices wrap every 8 or 16 cells), so each is worked out once into a
 * table and looked up by world pixel — no seams, and fast.
 */
function cached<V>(pw: number, ph: number, fn: (x: number, y: number) => V): (gx: number, gy: number) => V {
  let table: V[] | null = null;
  return (gx, gy) => {
    if (!table) { table = new Array(pw * ph); for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) table[y * pw + x] = fn(x, y); }
    const x = ((gx % pw) + pw) % pw, y = ((gy % ph) + ph) % ph;
    return table[y * pw + x];
  };
}
const WAVES = cached(24 * 8, 18 * 8, wave);
const GRASS = cached(64, 64, (x, y) => tufts(x, y, COL.grass, COL.grassD, COL.grassL));
const SCRUB = cached(80, 80, (x, y) => bushes(x, y, COL.scrub, COL.scrubD, 10, 3.2));
const PARK = cached(112, 112, (x, y) => bushes(x, y, COL.park, COL.parkT, 14, 3.5, COL.parkTD));
const WOOD = cached(56, 56, trees);
