import Phaser from 'phaser';
import { setupCamera, WIDTH, ZOOM } from '../view';
import { hideBar, touch } from '../answerBar';
import { playMusic, setMuted } from '../sound';
import { HEX, isNewPlayer, PAL, save, state, type Mode } from '../state';
import { confettiBackground, FONT_ZH, glisten, text } from '../ui';
import { JP, ROM_NAME, rom } from '../rom';
import { setRomanisation } from '../../../../src/shared/romanisation';

const TITLE = [HEX.red, HEX.ink, HEX.gold, HEX.rose];

const MODES: { mode: Mode; title: string; line: string; example: string; fill: number }[] = [
  { mode: 'listen', title: 'Listen', line: 'hear a number, type the digits', example: '"sāam sahp baat" → 38', fill: PAL.red },
  { mode: 'read', title: 'Read', line: `see a number, write it in ${ROM_NAME}`, example: '38 → sāam sahp baat', fill: PAL.gold },
];

/** Step 1: pick a mode. Step 2 is LevelsScene. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    hideBar();
    setupCamera(this);
    playMusic(this, 'menu');
    const cx = WIDTH / 2;
    confettiBackground(this);
    this.arcadeLink();

    // Title with per-letter colour cycling.
    const title = 'CANTO NUMBERS';
    const letters = [...title].map((c, i) =>
      text(this, cx - (title.length * 22) / 2 + i * 22 + 11, 64, c, 28, HEX.ink));
    this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => letters.forEach((l, i) => {
        l.setColor(TITLE[(i + Math.floor(this.time.now / 120)) % TITLE.length]);
        l.y = 64 + Math.sin(this.time.now / 150 + i) * 3;
      }),
    });
    text(this, cx, 100, `cantonese numbers & money, in ${ROM_NAME}`, 12, HEX.dim, true);
    text(this, cx, 150, 'choose how to practise', 11, HEX.ink);

    MODES.forEach((m, i) => this.card(cx, 230 + i * 150, m));

    // On-screen keys vs typing: a PC choice only (phones always use the in-app keys).
    if (!touch) {
      const input = text(this, cx, 526, '', 11, HEX.rose).setInteractive({ useHandCursor: true });
      const refresh = () => input.setText(`answer with: ${state.tiles ? 'on-screen keys' : 'keyboard'}  ⇄`);
      input.on('pointerdown', () => {
        state.tiles = !state.tiles;
        save();
        refresh();
      });
      refresh();
    }
    // how Cantonese is written in every game of the arcade (shared setting): reloads to switch everything
    const romBtn = text(this, cx, touch ? 526 : 500, `writing: ${ROM_NAME}  ⇄`, 11, HEX.rose).setInteractive({ useHandCursor: true });
    romBtn.on('pointerdown', () => { setRomanisation(JP ? 'yale' : 'jyutping'); window.location.reload(); });
    const sound = text(this, cx, 552, '', 11, HEX.rose).setInteractive({ useHandCursor: true });
    const refreshSound = () => sound.setText(`music & sfx: ${state.muted ? 'off' : 'on'}  ⇄`);
    sound.on('pointerdown', () => {
      setMuted(!state.muted);
      save();
      refreshSound();
    });
    refreshSound();
    text(this, cx, 580, 'new here? start with listen, level 1', 9, HEX.dim);
    text(this, WIDTH - 8, 594, `v${__APP_VERSION__}`, 8, HEX.dim).setOrigin(1, 0.5);
    document.getElementById('loading')?.remove();

    this.input.keyboard?.on('keydown-L', () => this.pick('listen'));
    this.input.keyboard?.on('keydown-R', () => this.pick('read'));
    this.input.keyboard?.on('keydown-ESC', () => this.toArcade());
  }

  /**
   * The way back to the arcade room: part of this menu, in the corner where Levels has its
   * "‹ back", so it never floats over anything in the game. Esc does the same.
   */
  private arcadeLink(): void {
    const label = text(this, 14, 22, '‹ arcade', 12, HEX.dim).setOrigin(0, 0.5);
    const zh = this.add.text(label.x + label.width + 6, 22, '機舖', {
      fontFamily: FONT_ZH, fontSize: '12px', color: HEX.dim, resolution: ZOOM,
    }).setOrigin(0, 0.5);
    const hit = this.add
      .zone(8, 22, zh.x + zh.width - 2, 28)
      .setOrigin(0, 0.5)
      .setName('arcade-back')
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => [label, zh].forEach((t) => t.setColor(HEX.ink)));
    hit.on('pointerout', () => [label, zh].forEach((t) => t.setColor(HEX.dim)));
    hit.on('pointerdown', () => this.toArcade());
  }

  private toArcade(): void {
    window.location.href = '../../arcade/'; // the arcade room (the site's front page is the open world)
  }

  private card(cx: number, y: number, m: (typeof MODES)[number]): void {
    const w = 300;
    const h = 126;
    this.add.rectangle(cx + 5, y + 5, w, h, 0x000000, 0.5);
    const box = this.add.rectangle(cx, y, w, h, PAL.track).setStrokeStyle(4, m.fill).setInteractive({ useHandCursor: true });
    const parts = [
      box,
      text(this, cx, y - 34, m.title, 26, Phaser.Display.Color.IntegerToColor(m.fill).rgba),
      text(this, cx, y + 4, m.line, 13, HEX.ink, true),
      text(this, cx, y + 34, rom(m.example), 13, HEX.dim, true),
    ];
    parts.slice(1).forEach((p) => p.setDepth(2));
    box.on('pointerdown', () => this.pick(m.mode));
    if (m.mode === 'listen' && isNewPlayer()) {
      glisten(this, cx, y, w, h);
    } else {
      box.on('pointerover', () => parts.forEach((p) => p.setScale(1.03)));
      box.on('pointerout', () => parts.forEach((p) => p.setScale(1)));
    }
  }

  private pick(mode: Mode): void {
    state.mode = mode;
    save();
    this.scene.start('Levels');
  }
}
