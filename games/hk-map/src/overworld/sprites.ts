// Pixel sprites for the open world, drawn from little letter grids into Phaser textures
// (the same way MapScene draws its markers). 16 px, the size of one tile.
import Phaser from 'phaser';

type Pal = Record<string, number>;

function draw(scene: Phaser.Scene, key: string, rows: string[], pal: Pal) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = pal[ch]; if (c !== undefined) { g.fillStyle(c, 1); g.fillRect(x, y, 1, 1); } }));
  g.generateTexture(key, rows[0].length, rows.length);
  g.destroy();
}

const PERSON: Pal = { k: 0x241a12, h: 0x2b2420, s: 0xf2c79a, r: 0xd8463c, R: 0xa83228, b: 0x2f4a7a, w: 0xffffff, o: 0x000000 };

/** The player: facing down / up / sideways (flip for left), two walking frames each. */
const FRAMES: Record<string, string[]> = {
  down0: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khsssshk....', '....ksoksoks....', '....kssssssk....', '.....kssssk.....', '....kRrrrrRk....', '...ksRrrrrRsk...', '...ksRrrrrRsk...', '....kkrrrrkk....', '.....kbbbbk.....', '.....kbkkbk.....', '.....kbk.kbk....', '.....kkk.kkk....', '................'],
  down1: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khsssshk....', '....ksoksoks....', '....kssssssk....', '.....kssssk.....', '....kRrrrrRk....', '...ksRrrrrRsk...', '...ksRrrrrRsk...', '....kkrrrrkk....', '.....kbbbbk.....', '.....kbkkbk.....', '....kbk.kbk.....', '....kkk.kkk.....', '................'],
  up0: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '.....khhhhk.....', '....kRrrrrRk....', '...ksRrrrrRsk...', '...ksRrrrrRsk...', '....kkrrrrkk....', '.....kbbbbk.....', '.....kbkkbk.....', '.....kbk.kbk....', '.....kkk.kkk....', '................'],
  up1: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '....khhhhhhk....', '.....khhhhk.....', '....kRrrrrRk....', '...ksRrrrrRsk...', '...ksRrrrrRsk...', '....kkrrrrkk....', '.....kbbbbk.....', '.....kbkkbk.....', '....kbk.kbk.....', '....kkk.kkk.....', '................'],
  side0: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhssk.....', '....khhsoks.....', '....khssssk.....', '.....kssssk.....', '.....kRrrrk.....', '.....kRrrsk.....', '.....kRrrsk.....', '.....kkrrkk.....', '......kbbk......', '......kbbk......', '......kbbk......', '......kkkk......', '................'],
  side1: ['......kkkk......', '.....khhhhk.....', '....khhhhhhk....', '....khhhssk.....', '....khhsoks.....', '....khssssk.....', '.....kssssk.....', '.....kRrrrk.....', '.....kRrrsk.....', '.....kRrrsk.....', '.....kkrrkk.....', '.....kbbbbk.....', '....kbk..kbk....', '....kbk...kk....', '....kkk.........', '................'],
};

/** Landmarks: a station entrance, a church, a sight. */
const MARKS: Record<string, [string[], Pal]> = {
  'lm-s': [['..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwwrrwwwwrrwwk.', '.kwwwrrwwrrwwwk.', '.kwrrrrrrrrrrwk.', '.kwwwrrwwrrwwwk.', '.kwwrrwwwwrrwwk.', '.kwwwwwwwwwwwwk.', 'kkkkkkkkkkkkkkkk', 'kggggggggggggggk', 'kgkkkkggkkkkkggk', 'kgk..kggk..kkggk', 'kgk..kggk..kkggk', 'kgkkkkggkkkkkggk', 'kggggggggggggggk', 'kkkkkkkkkkkkkkkk'], { k: 0x241a12, w: 0xffffff, r: 0xd8231f, g: 0xc8c4bc }],
  'lm-c': [['.......kk.......', '......kwwk......', '.......kk.......', '......kppk......', '.....kppppk.....', '....kppppppk....', '...kppppppppk...', '..kppppppppppk..', '.kkkkkkkkkkkkkk.', '.kwwwwwwwwwwwwk.', '.kwwwkkkkwwwwwk.', '.kwwkyyyykwwwwk.', '.kwwkyyyykwwwwk.', '.kwwkyyyykwwwwk.', '.kwwkyyyykwwwwk.', '.kkkkkkkkkkkkkk.'], { k: 0x241a12, w: 0xf4ecd8, p: 0x8e44ad, y: 0x6b4a2a }],
  'lm-p': [['.......kk.......', '......kyyk......', '......kyyk......', '.kkkkkkyykkkkkk.', '.kyyyyyyyyyyyyk.', '..kyyyyyyyyyyk..', '...kyyyyyyyyk...', '...kyyykkyyyk...', '..kyyyk..kyyyk..', '..kyyk....kyyk..', '..kkk......kkk..', '................', '..kkkkkkkkkkkk..', '..kssssssssssk..', '.kkkkkkkkkkkkkk.', '................'], { k: 0x241a12, y: 0xf6c945, s: 0xb8a888 }],
};

export function makeSprites(scene: Phaser.Scene) {
  for (const [k, rows] of Object.entries(FRAMES)) draw(scene, 'pl-' + k, rows, PERSON);
  for (const [k, [rows, pal]] of Object.entries(MARKS)) draw(scene, k, rows, pal);
}
