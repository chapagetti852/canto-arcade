// The shapes of 香港通's data (public/js/data.js, from build/make_data.py) and of its save (localStorage
// 'hkmapgame-v3'). The save's fields are only ever added to, never renamed: old saves must keep loading.

/** l MTR line · s station · p sight · c church · d district · r region */
export type ItemType = 'l' | 's' | 'p' | 'c' | 'd' | 'r';

export interface Item {
  /** key: 'S:TSY', 'L:TWL', 'D:葵青區', 'P:…', 'X:…' */
  k: string;
  t: ItemType;
  hz: string;
  yale: string;
  en: string;
  /** the Yale syllables, one per character */
  syl: string[];
  x: number;
  y: number;
  /** the Anki search that finds this item's note (Anki mode), or null */
  anki: string | null;
  fact?: string;
  /** level it first appears in */
  lv?: number;
  /** what the name means */
  nm?: string;
  more?: string;
  /** stations: the MTR lines through it */
  lines?: string[];
  /** the district it is in */
  dist?: string;
  near?: string;
  tour?: string;
  dense?: boolean;
  addr?: string;
  /** MTR lines: colour and the station sequences of each branch */
  color?: string;
  seq?: string[][];
}

export interface Level { n: number; zh: string; yale: string; en: string; keys: string[] }
export interface Line { color: string; seq: string[][]; hz: string; yale: string; en: string }
export interface Tour { id: string; en: string; items: string[] }
export interface Geo { poly: [number, number][]; border: unknown[]; fill: unknown[]; bb: [number, number, number, number] }
export interface Pier { hz: string; yale: string; en: string; land: [number, number]; dock: [number, number]; dir: [number, number] }

export interface HKData {
  /** world size in world units (1 unit ≈ 60 m) */
  W: number;
  H: number;
  items: Item[];
  lines: Record<string, Line>;
  tours: Tour[];
  geo: Record<string, Geo>;
  levels: Level[];
  /** district/region key → [channel, value] in img/areas.png */
  areaIdx: Record<string, [number, number]>;
  ferries: { piers: Record<string, Pier>; routes?: unknown[]; [k: string]: unknown };
  cat: Record<string, string>;
  sea: string;
}

export interface Photo { u: string; by: string; lic: string }

/** What you have done with one item. */
export interface ItemRecord {
  /** the day you first met it */
  s?: string;
  /** listening (find it) and Yale (type it) successes */
  l?: number;
  y?: number;
  /** the day it was mastered */
  m?: string;
  /** recent days with a success */
  days?: string[];
  lastDay?: string;
  [k: string]: unknown;
}

export interface Settings { voice: string; region: string; key: string; sfx: boolean; music: boolean; tones: boolean; [k: string]: unknown }
export interface MissionState { id: string; n: number; done: boolean }

export interface SaveState {
  v: 3;
  items: Record<string, ItemRecord>;
  updated: number;
  /** points per day 'YYYY-MM-DD' */
  points: Record<string, number>;
  best: Record<string, number>;
  missions: { date: string; list: MissionState[] } | null;
  flags: Record<string, any>;
  /** levels opened (the badges, later) */
  levels: Record<string, unknown>;
  /** items sent to Anki, by day */
  sent: Record<string, string>;
  roamAt: [number, number] | null;
  homeT?: number;
  settings: Settings;
  [k: string]: unknown;
}
