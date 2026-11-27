// The open world (phase 1 prototype): Hong Kong as 30 m tiles you walk across one step at a time,
// with a fixed camera. Opened with ?world; it reads your progress but never changes it.
//
// The ground is drawn as chunks of CHUNK×CHUNK cells, painted by a worker (paint.worker.ts) as they come
// into view and dropped when far away, so only ~10–20 chunk textures ever exist.
import Phaser from 'phaser';
import { BY, ITEMS } from '../core/util';
import { stars } from '../core/state';
import { districtAt } from '../map/geo';
import { banner, toast } from '../ui/dom';
import { say } from '../audio/voice';
import { rom } from '../core/rom';
import type { Item } from '../types';
import { CHUNK, Grid, cellOf, chunksFor } from './grid';
import { DIRS, TILE, type Dir } from './terrain';
import { makeSprites } from './sprites';

/** cells per second */
const WALK = 6, RUN = 12;
/** about how many tiles fit along the screen's shorter side (a Game Boy Advance shows 10 × 15) */
const TILES_SHORT = 15;

interface Chunk { key: string; img?: Phaser.GameObjects.Image; texKey?: string }
interface Landmark { it: Item; cell: [number, number]; sprite: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Container }

export class OverworldScene extends Phaser.Scene {
  grid!: Grid;
  /** the player's cell, and where they face */
  px = 0;
  py = 0;
  facing: Dir = 'down';
  moving = false;
  /** steps still to take on a tap-to-walk route */
  route: Dir[] = [];
  /** true once the ground around the player is drawn */
  ready = false;
  chunks = new Map<string, Chunk>();
  /** chunk paint times in ms (for the playtest and tuning) */
  paintMs: number[] = [];
  near: Item | null = null;
  district: Item | null = null;
  player!: Phaser.GameObjects.Sprite;
  marks: Landmark[] = [];
  private worker!: Worker;
  private pending = new Set<string>();
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift', Phaser.Input.Keyboard.Key>;
  private walkT = 0;
  private padDir: Dir | null = null;
  private camKey = '';

  constructor() { super('overworld'); }

  preload() { this.load.image('world', 'img/world.png?v=__BUILD__'); }

  create() {
    // the terrain grid: one byte per cell, read from the picture's red channel
    const src = this.textures.get('world').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g2 = c.getContext('2d', { willReadFrequently: true })!; g2.drawImage(src, 0, 0);
    const rgba = g2.getImageData(0, 0, c.width, c.height).data, cells = new Uint8Array(c.width * c.height);
    for (let i = 0; i < cells.length; i++) cells[i] = rgba[i * 4];
    this.grid = new Grid(c.width, c.height, cells);
    this.textures.remove('world');

    this.worker = new Worker(new URL('./paint.worker.ts', import.meta.url), { type: 'module' });
    this.worker.postMessage({ init: { w: this.grid.w, h: this.grid.h, cells } });
    this.worker.onmessage = (e: MessageEvent) => this.gotChunk(e.data);
    this.events.once('shutdown', () => this.worker.terminate());

    makeSprites(this);
    this.cameras.main.setBackgroundColor('#34628f');
    this.cameras.main.setRoundPixels(true);

    // you set out from Tsing Yi station
    const [sx, sy] = cellOf(BY['S:TSY'].x, BY['S:TSY'].y);
    const start = this.grid.nearestStandable(sx, sy + 2) ?? [sx, sy];
    this.px = start[0]; this.py = start[1];
    this.player = this.add.sprite(...this.cellCenter(this.px, this.py), 'pl-down0').setOrigin(0.5, 0.75).setDepth(10);
    this.cameras.main.startFollow(this.player, true);

    for (const it of ITEMS) {
      if (it.t !== 's' && it.t !== 'p' && it.t !== 'c') continue;
      const cell = cellOf(it.x, it.y);
      const sprite = this.add.image(...this.cellCenter(...cell), 'lm-' + it.t).setDepth(5);
      this.marks.push({ it, cell, sprite });
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', shift: 'SHIFT' }) as typeof this.keys;
    kb.on('keydown-ENTER', () => this.visit()); kb.on('keydown-SPACE', () => this.visit());
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 8) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y), cx = Math.floor(wp.x / TILE), cy = Math.floor(wp.y / TILE);
      const lm = this.marks.find((m) => m.cell[0] === cx && m.cell[1] === cy);
      if (lm && this.near === lm.it) { this.visit(); return; }
      const goal = this.grid.nearestStandable(cx, cy, 2); if (!goal) return;
      this.route = this.grid.path(this.px, this.py, goal[0], goal[1], 40) ?? [];
    });

    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();
    this.loadChunks();
    this.onArrive();
  }

  /**
   * A fixed zoom with about TILES_SHORT tiles along the shorter side. Each tile pixel covers a whole number
   * of device pixels (zoom × devicePixelRatio is whole), so the pixel art stays sharp on any screen.
   */
  fitZoom() {
    const dpr = window.devicePixelRatio || 1, short = Math.min(this.scale.width, this.scale.height);
    const devPx = Math.max(1, Math.round(dpr * short / (TILE * TILES_SHORT)));
    this.cameras.main.setZoom(devPx / dpr);
  }

  cellCenter(x: number, y: number): [number, number] { return [x * TILE + TILE / 2, y * TILE + TILE / 2]; }

  /** Ask the worker for the chunks around the view (nearest first), drop the far ones. */
  loadChunks() {
    const v = this.cameras.main.worldView, t = TILE;
    const want = chunksFor(Math.floor(v.x / t), Math.floor(v.y / t), Math.floor(v.right / t), Math.floor(v.bottom / t), 1);
    const [pcx, pcy] = [Math.floor(this.px / CHUNK), Math.floor(this.py / CHUNK)];
    want.sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return Math.hypot(ax - pcx, ay - pcy) - Math.hypot(bx - pcx, by - pcy); });
    for (const k of want) {
      if (this.chunks.has(k) || this.pending.has(k) || this.pending.size >= 4) continue;
      const [cx, cy] = k.split(',').map(Number);
      if (cx < -1 || cy < -1 || cx * CHUNK > this.grid.w || cy * CHUNK > this.grid.h) { this.chunks.set(k, { key: k }); continue; } // open sea: the background colour
      this.pending.add(k); this.worker.postMessage({ cx, cy });
    }
    const keep = new Set(chunksFor(Math.floor(v.x / t), Math.floor(v.y / t), Math.floor(v.right / t), Math.floor(v.bottom / t), 2));
    for (const [k, ch] of this.chunks) if (!keep.has(k)) { ch.img?.destroy(); if (ch.texKey) this.textures.remove(ch.texKey); this.chunks.delete(k); }
    if (!this.ready) {
      const mine = chunksFor(this.px, this.py, this.px, this.py, 1);
      if (mine.every((k) => this.chunks.has(k))) { this.ready = true; this.game.events.emit('world-ready'); }
    }
  }

  private gotChunk(d: { cx: number; cy: number; px: Uint8ClampedArray; ms: number }) {
    const k = d.cx + ',' + d.cy; this.pending.delete(k); this.paintMs.push(Math.round(d.ms));
    if (!this.sys.isActive()) return;
    const S = CHUNK * TILE, texKey = 'chunk:' + k;
    const tex = this.textures.createCanvas(texKey, S, S)!;
    tex.getContext().putImageData(new ImageData(d.px as Uint8ClampedArray<ArrayBuffer>, S, S), 0, 0); tex.refresh();
    const img = this.add.image(d.cx * S, d.cy * S, texKey).setOrigin(0).setDepth(0);
    this.chunks.set(k, { key: k, img, texKey });
    this.loadChunks();
  }

  private inputDir(): Dir | null {
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) return 'left';
    if (k.right.isDown || k.d.isDown) return 'right';
    if (k.up.isDown || k.w.isDown) return 'up';
    if (k.down.isDown || k.s.isDown) return 'down';
    return this.padDir;
  }

  /** for the on-screen pad (phones) */
  setPad(d: Dir | null) { this.padDir = d; if (d) this.route = []; }

  update(_t: number, dt: number) {
    // the camera crossed into another chunk (walking, or a jump like an MTR ride): fetch the ground there
    const v = this.cameras.main.worldView, camKey = Math.floor(v.centerX / (TILE * CHUNK)) + ',' + Math.floor(v.centerY / (TILE * CHUNK));
    if (camKey !== this.camKey) { this.camKey = camKey; this.loadChunks(); }
    if (!this.ready) return;
    this.walkT += dt;
    if (this.moving) return;
    let dir = this.inputDir();
    if (dir) this.route = []; else if (this.route.length) dir = this.route.shift()!;
    if (!dir) { this.player.setTexture(this.frame(0)); return; }
    this.face(dir);
    const to = this.grid.step(this.px, this.py, dir);
    if (!to) { this.route = []; this.player.setTexture(this.frame(0)); return; }
    const speed = this.keys.shift.isDown || this.route.length > 12 ? RUN : WALK;
    this.moving = true; this.px = to[0]; this.py = to[1];
    const [tx, ty] = this.cellCenter(this.px, this.py);
    this.player.setTexture(this.frame(1));
    this.tweens.add({ targets: this.player, x: tx, y: ty, duration: 1000 / speed, onComplete: () => { this.moving = false; this.onArrive(); } });
  }

  private frame(n: 0 | 1) { const side = this.facing === 'left' || this.facing === 'right'; return 'pl-' + (side ? 'side' : this.facing) + n; }
  private face(d: Dir) { this.facing = d; this.player.setFlipX(d === 'left'); }

  /** after each step: load ground, the district banner, nearby landmarks */
  private onArrive() {
    this.loadChunks();
    const d = districtAt((this.px + 0.5) / 2, (this.py + 0.5) / 2);
    if (d && d !== this.district) { this.district = d; banner(`<span class="big">${d.hz}</span><br><span style="color:#8a5400">${d.yale}</span><br><span style="color:#6b665b">${d.en}</span>`, 'paper'); }
    let best: Landmark | null = null, bd = 1e9;
    for (const m of this.marks) { const dd = Math.max(Math.abs(m.cell[0] - this.px), Math.abs(m.cell[1] - this.py)); if (dd <= 2 && dd < bd) { bd = dd; best = m; } }
    const it = best ? best.it : null;
    if (it !== this.near) {
      for (const m of this.marks) if (m.label) { m.label.destroy(); m.label = undefined; }
      this.near = it;
      if (best) best.label = this.nameTag(best);
    }
  }

  private nameTag(m: Landmark): Phaser.GameObjects.Container {
    const known = stars(m.it) > 0;
    const [x, y] = this.cellCenter(...m.cell);
    const a = this.add.text(0, 0, known ? m.it.hz : '？？？', { fontFamily: 'FP, FP2', fontSize: known ? '24px' : '12px', color: '#241a12', stroke: '#fbf3dd', strokeThickness: 3 }).setOrigin(0.5, 1);
    const parts: Phaser.GameObjects.GameObject[] = [a];
    if (known) parts.push(this.add.text(0, 1, rom(m.it.yale), { fontFamily: 'FP, FP2', fontSize: '12px', color: '#9a6a14', stroke: '#fbf3dd', strokeThickness: 3 }).setOrigin(0.5, 0));
    // 12 px on screen at any zoom, drawn at the screen's resolution so it stays sharp
    const z = this.cameras.main.zoom;
    for (const p of parts) (p as Phaser.GameObjects.Text).setResolution(z * (window.devicePixelRatio || 1));
    return this.add.container(x, y - TILE * 0.6, parts).setDepth(20).setScale(1 / z);
  }

  /** Enter / Space / tapping the landmark you stand by: hear its name */
  visit() {
    const it = this.near; if (!it) return;
    if (stars(it)) { say(it); toast(it.hz, it.yale, it.en); } else toast('？？？', '', 'A place you have not met yet — meet it in the lessons first.');
  }

  /** where the playtest can step without real input */
  tryStep(d: Dir) { return this.grid.step(this.px, this.py, d); }
  static DIRS = DIRS;
}
