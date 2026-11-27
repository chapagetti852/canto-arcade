// The arcade's machines. Adding a game = add its folder under public/games/ (or games/ with a
// build step) and one entry here. Pure data and rules: no Phaser, so it is unit-testable.

export interface Machine {
  id: string;
  hz: string;          // name on the marquee (traditional characters)
  yale: string;        // Yale with tone marks
  en: string;
  path: string | null; // where the game lives, relative to the arcade; null = coming soon
  color: number;       // cabinet accent
  x: number;           // cabinet centre in the room (px)
}

export const MACHINES: Machine[] = [
  { id: 'hk-map', hz: '香港通', yale: 'Hēunggóng Tūng', en: 'Hong Kong map', path: 'games/hk-map/', color: 0x3fa7d6, x: 104 },
  { id: 'canto-numbers', hz: '數字', yale: 'Soujih', en: 'Canto Numbers', path: 'games/canto-numbers/', color: 0xe94f37, x: 172 },
  { id: 'soon-1', hz: '即將推出', yale: 'jīkjēung tēuichēut', en: 'coming soon', path: null, color: 0x4a4f6a, x: 240 },
  { id: 'soon-2', hz: '即將推出', yale: 'jīkjēung tēuichēut', en: 'coming soon', path: null, color: 0x4a4f6a, x: 308 },
  { id: 'soon-3', hz: '即將推出', yale: 'jīkjēung tēuichēut', en: 'coming soon', path: null, color: 0x4a4f6a, x: 376 },
];

/** The floor line in front of the cabinets, where you stand to play. */
export const FRONT_Y = 132;

/** The machine you are standing at, if any: the nearest one whose front is within `reach` px. */
export function machineAt(px: number, py: number, machines: Machine[] = MACHINES, reach = 20): Machine | null {
  let best: Machine | null = null;
  let bestD = reach;
  for (const m of machines) {
    const d = Math.hypot(px - m.x, py - FRONT_Y);
    if (d <= bestD) { best = m; bestD = d; }
  }
  return best;
}

export const playable = (m: Machine | null): m is Machine & { path: string } => !!m && !!m.path;
