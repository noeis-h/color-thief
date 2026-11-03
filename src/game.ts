import { DIRS } from './iso';
import type { LevelDef } from './levels';

export type Color = 'red' | 'blue' | 'yellow';
export type Kind = 'crystal' | 'crate' | 'fire' | 'gen' | 'lamp' | 'ice' | 'water' | 'laser' | 'door';
export type Terrain = 'floor' | 'raised' | 'low' | 'wall' | 'water' | 'door';

export interface Cell { t: Terrain; top: number; bottom: number }

export interface Obj {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  z: number;
  color: Color | null;
  gone: boolean;
  anim: number; // eased 0..1 toward "active" (holds color / still present)
}

export type GameEvent =
  | { type: 'extract'; obj: Obj; color: Color }
  | { type: 'inject'; obj: Obj; color: Color }
  | { type: 'bump' }
  | { type: 'door'; open: boolean }
  | { type: 'win' };

export interface Snapshot { x: number; y: number; face: number; carry: Color | null; objs: [Color | null, boolean][] }

const TOPS: Record<Terrain, number> = { floor: 0, raised: 1, low: 0.45, wall: 2, water: -0.22, door: 2 };
const LETTER: Record<string, Color> = { R: 'red', B: 'blue', Y: 'yellow' };
const EXTRACTABLE: Kind[] = ['crystal', 'fire', 'gen', 'lamp', 'ice', 'water'];
const ACCEPTS: Partial<Record<Kind, Color | 'any'>> = {
  crystal: 'any', crate: 'red', fire: 'red', gen: 'yellow', lamp: 'yellow', ice: 'blue', water: 'blue',
};
const STEP_TIME = 0.17;

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class Game {
  w = 0;
  h = 0;
  cells: (Cell | null)[][] = [];
  objs: Obj[] = [];
  px = 0;
  py = 0;
  face = 1;
  carry: Color | null = null;
  // presentation state
  dx = 0;
  dy = 0;
  hop = 0;
  private fromX = 0;
  private fromY = 0;
  private moveT = 1;
  private path: number[] = [];
  private pendingTarget: Obj | null = null;
  private queued: number | null = null;
  private history: Snapshot[] = [];
  won = false;
  winT = 0;

  constructor(public def: LevelDef, public index: number, private emit: (e: GameEvent) => void) {
    const rows = def.map;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    let id = 0;
    const add = (kind: Kind, x: number, y: number, z: number, color: Color | null) =>
      this.objs.push({ id: id++, kind, x, y, z, color, gone: false, anim: color || kind === 'crate' ? 1 : 0 });

    for (let y = 0; y < this.h; y++) {
      const row: (Cell | null)[] = [];
      for (let x = 0; x < this.w; x++) {
        const ch = rows[y][x] ?? ' ';
        let t: Terrain | null = 'floor';
        switch (ch) {
          case ' ': t = null; break;
          case '#': t = 'raised'; break;
          case '-': t = 'low'; break;
          case 'W': t = 'wall'; break;
          case '~': t = 'water'; add('water', x, y, 0, null); break;
          case 'D': t = 'door'; add('door', x, y, 0, null); break;
          case 'P': this.px = x; this.py = y; break;
          case 'R': case 'B': case 'Y': add('crystal', x, y, 0, LETTER[ch]); break;
          case 'r': case 'b': case 'y': t = 'raised'; add('crystal', x, y, 1, LETTER[ch.toUpperCase()]); break;
          case 'O': add('crystal', x, y, 0, null); break;
          case 'X': add('crate', x, y, 0, null); break;
          case 'F': add('fire', x, y, 0, 'red'); break;
          case 'G': add('gen', x, y, 0, null); break;
          case 'L': add('lamp', x, y, 0, 'yellow'); break;
          case 'I': add('ice', x, y, 0, 'blue'); break;
          case 'l': add('laser', x, y, 0, null); break;
        }
        row.push(t ? { t, top: TOPS[t], bottom: -0.8 } : null);
      }
      this.cells.push(row);
    }
    // hanging stone supports under the island's front edges
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.cells[y][x];
      if (!c) continue;
      const edge = !this.cell(x + 1, y) || !this.cell(x, y + 1);
      const r = hash(x, y);
      if (edge && r < 0.4) c.bottom = -1.5 - r * 2.2;
    }
    this.dx = this.fromX = this.px;
    this.dy = this.fromY = this.py;
  }

  cell(x: number, y: number): Cell | null {
    return this.cells[y]?.[x] ?? null;
  }

  objsAt(x: number, y: number) {
    return this.objs.filter(o => o.x === x && o.y === y);
  }

  get lampsOn() {
    return this.objs.some(o => o.kind === 'lamp' && o.color);
  }

  get doorOpen() {
    return this.objs.filter(o => o.kind === 'gen').every(o => o.color);
  }

  walkable(x: number, y: number) {
    const c = this.cell(x, y);
    if (!c) return false;
    if (c.t === 'door') return this.doorOpen;
    if (c.t !== 'floor' && c.t !== 'water') return false;
    for (const o of this.objsAt(x, y)) {
      switch (o.kind) {
        case 'crystal': case 'gen': case 'lamp': case 'fire': return false;
        case 'crate': if (!o.gone) return false; break;
        case 'ice': if (o.color) return false; break;
        case 'water': if (o.color !== 'blue') return false; break;
        case 'laser': if (this.lampsOn) return false; break;
      }
    }
    return true;
  }

  canExtract(o: Obj) {
    return !!o.color && !o.gone && EXTRACTABLE.includes(o.kind);
  }

  accepts(o: Obj, c: Color) {
    const a = ACCEPTS[o.kind];
    return !o.gone && o.color === null && (a === 'any' || a === c);
  }

  /** What interacting with the object in direction `dir` would do, if anything. */
  intentAt(dir: number): { obj: Obj; action: 'extract' | 'inject'; dir: number } | null {
    const [ddx, ddy] = DIRS[dir];
    for (const o of this.objsAt(this.px + ddx, this.py + ddy)) {
      if (o.kind === 'laser' || o.kind === 'door' || o.gone) continue;
      if (!this.carry && this.canExtract(o)) return { obj: o, action: 'extract', dir };
      if (this.carry && this.accepts(o, this.carry)) return { obj: o, action: 'inject', dir };
    }
    return null;
  }

  /** What pressing interact would do right now: any of the four neighbours, the faced one first. */
  intent() {
    for (const d of [this.face, 0, 1, 2, 3]) {
      const it = this.intentAt(d);
      if (it) return it;
    }
    return null;
  }

  get busy() {
    return this.moveT < 1 || this.won;
  }

  /** Board state as plain data, for undo and for saving progress. */
  exportState(): Snapshot {
    return { x: this.px, y: this.py, face: this.face, carry: this.carry, objs: this.objs.map(o => [o.color, o.gone]) };
  }

  /** Restores a saved board instantly (no animation, empty undo history). */
  importState(s: Snapshot) {
    if (s.objs.length !== this.objs.length) return;
    this.apply(s);
    this.history = [];
    for (const o of this.objs) o.anim = o.kind === 'crate' ? (o.gone ? 0 : 1) : o.color ? 1 : 0;
  }

  private snapshot() {
    this.history.push(this.exportState());
    if (this.history.length > 200) this.history.shift();
  }

  undo() {
    if (this.won) return;
    const s = this.history.pop();
    if (!s) return;
    const wasOpen = this.doorOpen;
    this.apply(s);
    if (wasOpen !== this.doorOpen) this.emit({ type: 'door', open: this.doorOpen });
  }

  private apply(s: Snapshot) {
    this.px = this.dx = this.fromX = s.x;
    this.py = this.dy = this.fromY = s.y;
    this.moveT = 1;
    this.face = s.face;
    this.carry = s.carry;
    s.objs.forEach(([c, g], i) => { this.objs[i].color = c; this.objs[i].gone = g; });
    this.path = [];
    this.pendingTarget = null;
  }

  move(dir: number) {
    if (this.won) return;
    if (this.busy) { this.queued = dir; return; }
    this.path = [];
    this.pendingTarget = null;
    this.step(dir);
  }

  private step(dir: number) {
    this.face = dir;
    const nx = this.px + DIRS[dir][0];
    const ny = this.py + DIRS[dir][1];
    if (!this.walkable(nx, ny)) {
      this.emit({ type: 'bump' });
      return false;
    }
    this.snapshot();
    this.fromX = this.px;
    this.fromY = this.py;
    this.px = nx;
    this.py = ny;
    this.moveT = 0;
    if (this.cell(nx, ny)?.t === 'door') {
      this.won = true;
      this.emit({ type: 'win' });
    }
    return true;
  }

  /** Steal from or give to a neighbour: the one in `dir` if given, otherwise whichever responds. */
  interact(dir?: number) {
    if (this.busy) return;
    const it = dir === undefined ? this.intent() : this.intentAt(dir);
    if (!it) { this.emit({ type: 'bump' }); return; }
    this.face = it.dir;
    const wasOpen = this.doorOpen;
    this.snapshot();
    const o = it.obj;
    if (it.action === 'extract') {
      const c = o.color!;
      this.carry = c;
      o.color = null;
      this.emit({ type: 'extract', obj: o, color: c });
    } else {
      const c = this.carry!;
      if (o.kind === 'crate') o.gone = true;
      else o.color = c;
      this.carry = null;
      this.emit({ type: 'inject', obj: o, color: c });
    }
    if (wasOpen !== this.doorOpen) this.emit({ type: 'door', open: this.doorOpen });
  }

  /** Walk to a cell, or next to an object and face it. */
  goTo(tx: number, ty: number, obj?: Obj) {
    if (this.won) return;
    const goal = (x: number, y: number) =>
      obj ? DIRS.some(([a, b]) => x + a === obj.x && y + b === obj.y) : x === tx && y === ty;
    const key = (x: number, y: number) => y * 64 + x;
    const prev = new Map<number, [number, number]>(); // cell -> [fromKey, dir]
    const q: [number, number][] = [[this.px, this.py]];
    prev.set(key(this.px, this.py), [-1, -1]);
    let found: [number, number] | null = null;
    while (q.length) {
      const [x, y] = q.shift()!;
      if (goal(x, y)) { found = [x, y]; break; }
      DIRS.forEach(([a, b], d) => {
        const nx = x + a, ny = y + b;
        if (prev.has(key(nx, ny)) || !this.walkable(nx, ny)) return;
        prev.set(key(nx, ny), [key(x, y), d]);
        q.push([nx, ny]);
      });
    }
    if (!found) { this.emit({ type: 'bump' }); return; }
    const dirs: number[] = [];
    let k = key(found[0], found[1]);
    while (prev.get(k)![0] !== -1) { const [pk, d] = prev.get(k)!; dirs.unshift(d); k = pk; }
    this.path = dirs;
    this.pendingTarget = obj ?? null;
    if (!this.busy) this.advancePath();
  }

  private advancePath() {
    if (this.path.length) {
      if (!this.step(this.path.shift()!)) this.path = [];
      return;
    }
    if (this.pendingTarget) {
      const o = this.pendingTarget;
      this.pendingTarget = null;
      const d = DIRS.findIndex(([a, b]) => this.px + a === o.x && this.py + b === o.y);
      if (d >= 0) this.face = d; // arrive facing it; SPACE does the stealing
    }
  }

  update(dt: number) {
    if (this.moveT < 1) {
      this.moveT = Math.min(1, this.moveT + dt / STEP_TIME);
      const t = this.moveT;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.dx = this.fromX + (this.px - this.fromX) * e;
      this.dy = this.fromY + (this.py - this.fromY) * e;
      this.hop = Math.sin(Math.PI * t) * 0.14;
      if (this.moveT >= 1) {
        this.hop = 0;
        if (this.queued !== null) { const q = this.queued; this.queued = null; this.step(q); }
        else this.advancePath();
      }
    }
    if (this.won) this.winT += dt;
    for (const o of this.objs) {
      const goal = o.kind === 'crate' ? (o.gone ? 0 : 1) : o.color ? 1 : 0;
      const sp = o.kind === 'crate' ? 1.6 : 4;
      o.anim += Math.sign(goal - o.anim) * Math.min(Math.abs(goal - o.anim), dt * sp);
    }
  }
}
