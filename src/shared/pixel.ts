import Phaser from 'phaser';

/** Draws pixel art from rows of characters ('.' = transparent) into a texture. */
export function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], palette: Record<string, number>): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = palette[ch];
      if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
    });
  });
  g.generateTexture(key, Math.max(...rows.map((r) => r.length)), rows.length);
  g.destroy();
}

/** The arcade's text style: Fusion Pixel 12px (Chinese + Yale) at its native size, so it stays crisp. */
export const TXT = (color = '#f5e6c8', size = 12): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'PixelZh, monospace',
  fontSize: `${size}px`,
  color,
});
