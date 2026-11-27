import Phaser from 'phaser';
import { MACHINES } from '../logic/machines';
import { pixelTexture } from '../shared/pixel';

/** Waits for the pixel fonts, draws every texture in code, then opens the arcade. */
export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('PreloaderScene');
  }

  async create(): Promise<void> {
    this.add.text(240, 135, 'loading…', { fontFamily: 'monospace', fontSize: '10px', color: '#8a7fb0' }).setOrigin(0.5);
    try {
      await Promise.race([
        Promise.all([document.fonts.load('12px PixelZh', '廣東話機舖'), document.fonts.load('8px Silkscreen')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      // fall back to the system font
    }
    this.makeRoom();
    this.makePlayer();
    for (const m of MACHINES) this.makeCabinet(`cab-${m.id}`, m.color, !!m.path);
    this.scene.start('ArcadeScene');
  }

  /** Back wall and carpet, baked once into a single 480x270 texture. */
  private makeRoom(): void {
    const g = this.add.graphics();
    // wall
    g.fillStyle(0x231a3d).fillRect(0, 0, 480, 100);
    for (let x = 0; x < 480; x += 24) g.fillStyle(0x1e1636).fillRect(x, 0, 2, 92);
    g.fillStyle(0x3b2d63).fillRect(0, 92, 480, 4);
    g.fillStyle(0x140f26).fillRect(0, 96, 480, 4);
    // carpet: the classic arcade confetti pattern, on a 16px tile
    g.fillStyle(0x15102a).fillRect(0, 100, 480, 170);
    const bits: [number, number, number, number, number][] = [
      [2, 3, 2, 1, 0xff4fa3], [10, 1, 1, 2, 0x2de2e6], [6, 9, 2, 1, 0xffd23f], [13, 12, 1, 2, 0xff4fa3], [3, 13, 1, 1, 0x2de2e6], [9, 6, 1, 1, 0x7b5cff],
    ];
    for (let ty = 100; ty < 270; ty += 16) {
      for (let tx = 0; tx < 480; tx += 16) {
        if (((tx + ty) / 16) % 2) g.fillStyle(0x181230).fillRect(tx, ty, 16, 16);
        for (const [x, y, w, h, c] of bits) g.fillStyle(c, 0.55).fillRect(tx + x, ty + y, w, h);
      }
    }
    // the wall's floor shadow
    g.fillStyle(0x000000, 0.35).fillRect(0, 100, 480, 6);
    g.generateTexture('room', 480, 270);
    g.destroy();
  }

  private makePlayer(): void {
    const P = { h: 0x3a2a1c, s: 0xf1c27d, e: 0x222222, c: 0x2f6fb5, w: 0xe8e4d8, p: 0x2b2b3a, d: 0x111111 };
    const top = ['...hhhh...', '..hhhhhh..', '..hssssh..', '...eses...', '...ssss...', '..cccccc..', '.sccwwccs.', '.sccccccs.', '..cccccc..', '..pppppp..'];
    pixelTexture(this, 'player0', [...top, '..pp..pp..', '..pp..pp..', '..dd..dd..'], P);
    pixelTexture(this, 'player1', [...top, '..pp...pp.', '.pp....pp.', '.dd....dd.'], P);
    pixelTexture(this, 'player2', [...top, '.pp...pp..', '.pp....pp.', '.dd....dd.'], P);
  }

  /** A 44x58 upright cabinet: marquee, screen bezel, control panel, coin door. */
  private makeCabinet(key: string, color: number, live: boolean): void {
    const W = 44;
    const g = this.add.graphics();
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(35).color;
    g.fillStyle(0x0d0b17).fillRect(1, 2, W - 2, 56);                    // outline
    g.fillStyle(0x1b1b2a).fillRect(2, 3, W - 4, 54);                    // body
    g.fillStyle(dark).fillRect(2, 3, 3, 54).fillRect(W - 5, 3, 3, 54);  // side art
    g.fillStyle(color).fillRect(3, 3, W - 6, 12);                       // marquee
    g.fillStyle(0xffffff, live ? 0.25 : 0.08).fillRect(3, 3, W - 6, 2);
    g.fillStyle(0x07060d).fillRect(7, 16, 30, 20);                      // bezel
    g.fillStyle(0x2a2440).fillRect(4, 37, W - 8, 6);                    // control panel
    g.fillStyle(0x111111).fillRect(11, 38, 2, 3);                       // joystick
    g.fillStyle(0xe94f37).fillRect(10, 37, 4, 2);
    g.fillStyle(live ? 0xffd23f : 0x555555).fillRect(W - 19, 39, 3, 2);
    g.fillStyle(live ? 0x2de2e6 : 0x555555).fillRect(W - 14, 39, 3, 2);
    g.fillStyle(0x141320).fillRect(14, 46, 16, 9);                      // coin door
    g.fillStyle(live ? 0xff9a3c : 0x3a3a3a).fillRect(21, 48, 2, 4);     // coin slot glow
    g.generateTexture(key, W, 58);
    g.destroy();
  }
}
