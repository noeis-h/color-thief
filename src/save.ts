import type { Snapshot } from './game';
import { LEVELS } from './levels';

// Progress lives in this browser's localStorage; the game still runs (without saving) if it is blocked.
export interface SaveData {
  current: number; // level to resume
  unlocked: number; // highest playable level index
  best: number[]; // best stars per level, -1 = never cleared
  hints: number[]; // hints revealed in the current attempt of each level (0-3)
  board: { level: number; state: Snapshot } | null; // mid-level position
  seenHelp: boolean;
}

const KEY = 'colorthief.save.v2'; // v2: 20 levels

function defaults(): SaveData {
  return {
    current: 0,
    unlocked: 0,
    best: LEVELS.map(() => -1),
    hints: LEVELS.map(() => 0),
    board: null,
    seenHelp: false,
  };
}

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = { ...d, ...JSON.parse(raw) } as SaveData;
    s.best = d.best.map((v, i) => s.best?.[i] ?? v);
    s.hints = d.hints.map((v, i) => s.hints?.[i] ?? v);
    return s;
  } catch {
    return d;
  }
}

export const save: SaveData = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}

export function resetSave() {
  Object.assign(save, defaults(), { seenHelp: true });
  persist();
}

export const starsFor = (level: number) => Math.max(0, 3 - save.hints[level]);
