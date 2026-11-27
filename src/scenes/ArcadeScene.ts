import Phaser from 'phaser';
import { FRONT_Y, MACHINES, type Machine, machineAt, playable } from '../logic/machines';
import { ARCADE_KEY, parseArcade, progressLine, recordVisit } from '../logic/progress';
import { TXT } from '../shared/pixel';
import { ankiMode, mapWaiting, sendMapToAnki } from '../shared/ankiLink';
import { ankiReachable } from '../shared/anki';
import { syncAll, syncOn } from '../shared/gist';
import { closeAnkiPanel, openAnkiPanel, type PanelState } from '../ui/ankiPanel';
import { sfx } from '../shared/sfx';

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const SPEED = 70;
const CAB_BOTTOM = 120;

/** The arcade room: walk up to a machine and play it. */
export class ArcadeScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  near: Machine | null = null;
  launching: string | null = null;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private target: { x: number; y: number; play?: Machine } | null = null;
  private screens: { m: Machine; g: Phaser.GameObjects.Graphics; t?: Phaser.GameObjects.Text }[] = [];
  private bar!: { box: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text; play: Phaser.GameObjects.Text };
  private progress: Record<string, Phaser.GameObjects.Text> = {};
  private light: Phaser.GameObjects.Text | null = null;
  anki: PanelState = { reachable: false, waiting: 0, sync: 'off', lastSent: '' };
  private stepT = 0;
  private animT = 0;

  constructor() {
    super('ArcadeScene');
  }

  create(): void {
    this.near = null;
    this.launching = null;
    this.target = null;
    this.screens = [];
    this.progress = {};
    this.light = null;
    closeAnkiPanel();
    this.add.image(0, 0, 'room').setOrigin(0).setDepth(0);
    this.makeSign();
    const solid = this.physics.add.staticGroup();
    for (const m of MACHINES) this.makeMachine(m, solid);

    // you
    const save = parseArcade(ls.get(ARCADE_KEY));
    const back = MACHINES.find((m) => m.id === save.last);
    this.player = this.physics.add.sprite(back ? back.x : 240, back ? FRONT_Y + 8 : 205, 'player0').setDepth(10).setOrigin(0.5, 1);
    this.player.body!.setSize(8, 4).setOffset(1, 9);
    this.physics.world.setBounds(8, 104, 464, 140);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, solid);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('up,down,left,right,w,a,s,d') as typeof this.keys;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    kb.on('keydown', () => sfx.unlock());
    const press = (): void => { if (this.launching || !this.near) return; if (playable(this.near)) this.launch(this.near); else sfx.nope(); };
    kb.on('keydown-SPACE', press);
    kb.on('keydown-ENTER', press);

    this.makeBar();
    this.say(
      back ? '歡迎返嚟！' : '歡迎！',
      back ? 'Fūnyìhng fāanlàih! · welcome back' : 'Fūnyìhng! · walk up to a machine to play',
    );
    this.cameras.main.fadeIn(300, 0, 0, 0);
    if (ankiMode()) this.startAnki();
  }

  // ── The private Anki mode: sync between devices, then send learned places to Anki ──

  private startAnki(): void {
    this.light = this.add.text(472, 6, 'Anki ○', TXT('#8a8aa0')).setOrigin(1, 0).setDepth(30).setInteractive({ useHandCursor: true });
    this.light.on('pointerdown', (_p: Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      openAnkiPanel(this.anki, { sync: () => void this.ankiRound() });
    });
    void this.ankiRound();
  }

  async ankiRound(): Promise<void> {
    const alive = (): boolean => this.sys.isActive() && !!this.light;
    const setLight = (t: string, c: string): void => { if (alive()) this.light!.setText(t).setColor(c); };
    setLight('Anki …', '#8a8aa0');
    const sync = async (): Promise<void> => {
      if (!syncOn()) { this.anki.sync = 'not set up (connect it once in 香港通 → Settings)'; return; }
      try { await syncAll(); this.anki.sync = 'synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      catch (e) { this.anki.sync = 'failed: ' + (e as Error).message; }
    };
    await sync();
    if (alive()) this.refreshProgress();
    this.anki.reachable = await ankiReachable();
    if (this.anki.reachable) {
      try {
        const sent = await sendMapToAnki();
        if (sent && sent.places) {
          this.anki.lastSent = `Just now: ${sent.places} learned 香港通 place${sent.places > 1 ? 's' : ''} → ${sent.cards} card${sent.cards === 1 ? '' : 's'} unsuspended, due today.`;
          if (alive()) { sfx.coin(); this.say('解鎖！', `Gáaisó ${sent.cards} jēung kāat · ${sent.places} learned place${sent.places > 1 ? 's' : ''} from 香港通 now in Anki, due today`); }
          await sync();
        }
      } catch (e) {
        this.anki.lastSent = 'Sending to Anki failed: ' + (e as Error).message;
      }
    }
    try { this.anki.waiting = await mapWaiting(); } catch { this.anki.waiting = 0; }
    if (this.anki.reachable) setLight('Anki ●', '#4ade80');
    else setLight(this.anki.waiting ? `Anki ○ ${this.anki.waiting}` : 'Anki ○', '#8a8aa0');
  }

  private refreshProgress(): void {
    for (const [id, t] of Object.entries(this.progress)) { const line = progressLine(id, ls.get); if (line) t.setText(line); }
  }

  // ── the room ────────────────────────────────────────────────────────────────

  private makeSign(): void {
    const glow = this.add.text(240, 20, '廣東話機舖', { ...TXT('#ff4fa3', 24) }).setOrigin(0.5).setDepth(1).setAlpha(0.35).setScale(1.04);
    this.add.text(240, 20, '廣東話機舖', { ...TXT('#ffd1ea', 24) }).setOrigin(0.5).setDepth(2);
    this.add.text(240, 41, 'Gwóngdūngwá Gēipou · CANTO ARCADE', TXT('#2de2e6')).setOrigin(0.5).setDepth(2);
    // neon flicker
    this.time.addEvent({ delay: 2600, loop: true, callback: () => {
      this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.35 }, duration: 90, yoyo: true, repeat: Phaser.Math.Between(0, 2) });
    } });
  }

  private makeMachine(m: Machine, solid: Phaser.Physics.Arcade.StaticGroup): void {
    const live = playable(m);
    if (live) {
      const pool = this.add.ellipse(m.x, CAB_BOTTOM + 6, 52, 14, m.color, 0.16).setDepth(1);
      this.tweens.add({ targets: pool, alpha: { from: 0.1, to: 0.24 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(m.x, CAB_BOTTOM, `cab-${m.id}`).setOrigin(0.5, 1).setDepth(3);
    const box = solid.create(m.x, CAB_BOTTOM - 8, undefined) as Phaser.Physics.Arcade.Sprite;
    box.setVisible(false).setDisplaySize(44, 16).refreshBody();
    // marquee name
    this.add.text(m.x, CAB_BOTTOM - 49, live ? m.hz : 'SOON', live ? TXT('#ffffff') : { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#9a9ab0' })
      .setOrigin(0.5).setDepth(4);
    // attract-mode screen
    const g = this.add.graphics().setDepth(4);
    const t = m.id === 'canto-numbers' ? this.add.text(m.x, CAB_BOTTOM - 32, '38', { fontFamily: 'Silkscreen, monospace', fontSize: '8px', color: '#ffd23f' }).setOrigin(0.5).setDepth(5) : undefined;
    this.screens.push({ m, g, t });
    // your progress, on the floor in front
    const line = progressLine(m.id, ls.get);
    if (live) this.progress[m.id] = this.add.text(m.x, CAB_BOTTOM + 22, line ?? '', TXT('#c9b8ff')).setOrigin(0.5).setDepth(2).setAlpha(0.9);
  }

  private drawScreens(t: number): void {
    for (const { m, g, t: txt } of this.screens) {
      const x = m.x - 14, y = CAB_BOTTOM - 42;
      g.clear();
      if (m.id === 'hk-map') {
        g.fillStyle(0x1d4e7a).fillRect(x, y, 28, 20);
        g.fillStyle(0x6aa84e).fillRect(x + 3, y + 3, 10, 6).fillRect(x + 6, y + 9, 6, 3).fillRect(x + 15, y + 11, 9, 6).fillRect(x + 18, y + 8, 4, 3);
        g.fillStyle(0xd8d0c0).fillRect(x + 12, y + 10, 4, 1).fillRect(x + 15, y + 10, 1, 3);
        const dot = [[x + 8, y + 5], [x + 19, y + 13], [x + 9, y + 10]][Math.floor(t / 600) % 3];
        if (Math.floor(t / 300) % 2) g.fillStyle(0xe94f37).fillRect(dot[0], dot[1], 2, 2);
      } else if (m.id === 'canto-numbers') {
        g.fillStyle(0x14060a).fillRect(x, y, 28, 20);
        const k = Math.floor(t / 450);
        if (txt) { txt.setText(String((k * 37) % 100)); txt.setColor(['#ffd23f', '#2de2e6', '#ff4fa3'][k % 3]); }
        for (let i = 0; i < 4; i++) g.fillStyle([0xff4fa3, 0x2de2e6, 0xffd23f][(i + k) % 3]).fillRect(x + 3 + ((i * 7 + k * 3) % 22), y + 2 + ((i * 5 + k) % 4), 1, 1);
      } else {
        g.fillStyle(0x0c0c12).fillRect(x, y, 28, 20);
        for (let i = 0; i < 18; i++) g.fillStyle(0x4a4f6a, 0.5).fillRect(x + Phaser.Math.Between(0, 27), y + Phaser.Math.Between(0, 19), 1, 1);
      }
    }
  }

  // ── the bottom bar: what you're standing at, and the play button ───────────

  private makeBar(): void {
    const box = this.add.rectangle(240, 259, 480, 22, 0x0b0916, 0.92).setDepth(20).setStrokeStyle(1, 0x3b2d63);
    const name = this.add.text(8, 259, '', TXT('#ffd1ea')).setOrigin(0, 0.5).setDepth(21);
    const info = this.add.text(0, 259, '', TXT('#9a8fc4')).setOrigin(0, 0.5).setDepth(21);
    const play = this.add.text(472, 259, '', TXT('#2de2e6')).setOrigin(1, 0.5).setDepth(21).setInteractive({ useHandCursor: true });
    play.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); if (playable(this.near)) this.launch(this.near); });
    this.bar = { box, name, info, play };
  }

  private say(zh: string, rest: string, play = ''): void {
    this.bar.name.setText(zh);
    this.bar.info.setText(rest).setX(this.bar.name.x + this.bar.name.width + 8);
    this.bar.play.setText(play);
  }

  private showNear(m: Machine | null): void {
    if (m === this.near) return;
    this.near = m;
    if (!m) { this.say('', '← → ↑ ↓ / WASD to walk · tap to walk there'); return; }
    sfx.blip();
    const touch = this.sys.game.device.input.touch;
    if (playable(m)) this.say(m.hz, `${m.yale} · ${m.en}`, touch ? '▶ 玩 wáan' : '▶ SPACE 玩 wáan');
    else this.say(m.hz, `${m.yale} · ${m.en}`);
  }

  // ── moving and playing ─────────────────────────────────────────────────────

  private onTap(p: Pointer): void {
    sfx.unlock();
    if (this.launching) return;
    const hit = MACHINES.find((m) => Math.abs(p.worldX - m.x) < 22 && p.worldY > CAB_BOTTOM - 60 && p.worldY < CAB_BOTTOM + 14);
    if (hit) { this.target = { x: hit.x, y: FRONT_Y + 6, play: playable(hit) ? hit : undefined }; return; }
    if (p.worldY < 248) this.target = { x: p.worldX, y: Math.max(p.worldY, 110) };
  }

  launch(m: Machine & { path: string }): void {
    if (this.launching) return;
    this.launching = m.id;
    ls.set(ARCADE_KEY, JSON.stringify(recordVisit(parseArcade(ls.get(ARCADE_KEY)), m.id)));
    sfx.coin();
    this.player.setVelocity(0, 0);
    this.say(m.hz, 'INSERT COIN…', '');
    this.cameras.main.flash(120, 255, 240, 200);
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!(window as unknown as { __noNavigate?: boolean }).__noNavigate) window.location.href = m.path;
    });
  }

  update(_t: number, dt: number): void {
    this.animT += dt;
    this.drawScreens(this.animT);
    if (this.launching) return;
    const k = this.keys;
    let vx = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
    let vy = (k.up.isDown || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);
    if (vx || vy) this.target = null;
    else if (this.target) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.player.y, d = Math.hypot(dx, dy);
      if (d < 2) { const play = this.target.play; this.target = null; if (play && playable(play)) { this.showNear(play); this.launch(play); return; } }
      else { vx = dx / d; vy = dy / d; }
    }
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      if (vx) this.player.setFlipX(vx < 0);
      this.stepT += dt;
      this.player.setTexture(this.stepT % 300 < 150 ? 'player1' : 'player2');
      if (this.stepT > 300) { this.stepT -= 300; sfx.step(); }
    } else this.player.setTexture('player0');
    this.showNear(machineAt(this.player.x, this.player.y));
  }
}

type Pointer = Phaser.Input.Pointer;
