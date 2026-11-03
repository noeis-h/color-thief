import { assets, SPRITE_CFG, type SpriteCfg } from './assets';
import { ribbon, type FX, type Pt } from './fx';
import type { Cell, Color, Game, Obj } from './game';
import { iso, TH, TW, ZU } from './iso';

export const HEX: Record<Color, string> = { red: '#ff4b3e', blue: '#4aa8ff', yellow: '#ffd23d' };
const BG = '#232833';

export interface Cam { s: number; ox: number; oy: number }

let ctx: CanvasRenderingContext2D;
let dpr = 1;
let W = 0;
let H = 0;
export const cam: Cam = { s: 1, ox: 0, oy: 0 };
const base: Cam = { s: 1, ox: 0, oy: 0 };
const patterns = new Map<string, CanvasPattern>();
let fitW = 0; // viewport size the camera was last fitted to
let fitH = 0;

export function initRenderer(canvas: HTMLCanvasElement) {
  ctx = canvas.getContext('2d')!;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  window.addEventListener('resize', resize);
}

/** Fit the level into the viewport, leaving room for the HUD. */
export function fitCamera(g: Game) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cell(x, y);
    if (!c) continue;
    for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) for (const z of [c.top + 0.4, Math.max(c.bottom, -1.4)]) {
      const p = iso(cx, cy, z);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  fitW = W;
  fitH = H;
  const narrow = W < 760;
  const top = narrow ? 120 : 120, bottom = narrow ? 110 : 120;
  base.s = Math.max(0.15, Math.min((W - 60) / (x1 - x0), (H - top - bottom) / (y1 - y0), 1.5));
  base.ox = W / 2 - ((x0 + x1) / 2) * base.s;
  base.oy = top + (H - top - bottom) / 2 - ((y0 + y1) / 2) * base.s;
}

// ---- transforms ---------------------------------------------------------------------------

function T(a: number, b: number, c: number, d: number, e: number, f: number) {
  ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * e, dpr * f);
}
const screenSpace = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
/** Unit space of a horizontal plane at height z: (x, y) in cells. */
function topSpace(z: number) {
  const s = cam.s;
  T(TW / 2 * s, TH / 2 * s, -TW / 2 * s, TH / 2 * s, cam.ox, cam.oy - z * ZU * s);
}
/** Unit space of the vertical plane y = yEdge facing +y: (x, -z). */
function leftSpace(yEdge: number) {
  const s = cam.s;
  T(TW / 2 * s, TH / 2 * s, 0, ZU * s, cam.ox - yEdge * TW / 2 * s, cam.oy + yEdge * TH / 2 * s);
}
/** Unit space of the vertical plane x = xEdge facing +x: (y, -z). */
function rightSpace(xEdge: number) {
  const s = cam.s;
  T(-TW / 2 * s, TH / 2 * s, 0, ZU * s, cam.ox + xEdge * TW / 2 * s, cam.oy + xEdge * TH / 2 * s);
}
export function toScreen(p: Pt): Pt {
  return { x: cam.ox + p.x * cam.s, y: cam.oy + p.y * cam.s };
}
const W3 = (x: number, y: number, z: number) => toScreen(iso(x, y, z));

/** Texture as a pattern in unit space: one image spans `cells` units across and `units` down. */
function pat(key: string, cells = 2, units = 2, ox = 0, oy = 0) {
  const img = assets[key];
  let p = patterns.get(key);
  if (!p) { p = ctx.createPattern(img, 'repeat')!; patterns.set(key, p); }
  p.setTransform(new DOMMatrix().translateSelf(ox, oy).scaleSelf(cells / img.width, units / img.height));
  return p;
}

function voidFade(u: number, du: number, w0: number, dw: number) {
  const gr = ctx.createLinearGradient(0, 0.05, 0, 2.4);
  gr.addColorStop(0, 'rgba(35,40,51,0)');
  gr.addColorStop(1, 'rgba(35,40,51,0.94)');
  ctx.fillStyle = gr;
  ctx.fillRect(u, w0, du, dw);
}

/** One rectangular face in the current face space, textured, shaded and faded into the void. */
function face(u: number, du: number, zTop: number, zBot: number, fill: string | CanvasPattern, shade: number, alpha = 1) {
  if (zTop - zBot <= 0.001) return;
  const e = 0.004;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(u - e, -zTop - e, du + 2 * e, zTop - zBot + 2 * e);
  ctx.fillStyle = `rgba(24,28,40,${shade})`;
  ctx.fillRect(u - e, -zTop - e, du + 2 * e, zTop - zBot + 2 * e);
  if (zBot < 0.1) voidFade(u - e, du + 2 * e, -zTop - e, zTop - zBot + 2 * e);
  ctx.globalAlpha = 1;
}

const LEFT_SHADE = 0.06;
const RIGHT_SHADE = 0.24;

function topEdges(x0: number, y0: number, x1: number, y1: number, z: number, left: boolean, right: boolean, alpha = 0.55) {
  topSpace(z);
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  if (left) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
  if (right) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
}

/** Side spans of `c` exposed above or below the neighbour `n`. */
function exposed(c: Cell, top: number, n: Cell | null, nTop: number): [number, number][] {
  if (!n) return [[top, c.bottom]];
  const out: [number, number][] = [];
  if (nTop < top) out.push([top, Math.max(nTop, c.bottom)]);
  if (c.bottom < n.bottom) out.push([Math.min(n.bottom, top), c.bottom]);
  return out;
}

// ---- terrain --------------------------------------------------------------------------------

function effectiveTop(g: Game, x: number, y: number) {
  const c = g.cell(x, y);
  if (!c) return -99;
  if (c.t === 'water') {
    const w = g.objsAt(x, y).find(o => o.kind === 'water');
    return w && w.anim > 0.5 ? 0 : c.top;
  }
  return c.top;
}

function drawCell(g: Game, x: number, y: number, c: Cell, time: number) {
  const top = c.top;
  const wallTex = pat('tex_wall');
  const L = g.cell(x, y + 1), R = g.cell(x + 1, y);
  leftSpace(y + 1);
  for (const [a, b] of exposed(c, top, L, effectiveTop(g, x, y + 1))) face(x, 1, a, b, wallTex, LEFT_SHADE);
  rightSpace(x + 1);
  for (const [a, b] of exposed(c, top, R, effectiveTop(g, x + 1, y))) face(y, 1, a, b, wallTex, RIGHT_SHADE);

  if (c.t === 'water') { drawWater(g, x, y, c, time); return; }

  // a floor cell set into the back wall gets a back panel, so it reads as an alcove rather than a gap
  const isWall = (n: Cell | null) => n?.t === 'wall' || n?.t === 'door';
  if (c.t === 'floor' && !g.cell(x, y - 1) && isWall(g.cell(x - 1, y)) && isWall(g.cell(x + 1, y))) {
    leftSpace(y);
    face(x, 1, g.cell(x - 1, y)!.top, top, wallTex, 0.32);
  }

  topSpace(top);
  ctx.fillStyle = pat('tex_floor');
  ctx.fillRect(x - 0.004, y - 0.004, 1.008, 1.008);
  if (top > 0.5) { ctx.fillStyle = 'rgba(255,250,240,0.05)'; ctx.fillRect(x, y, 1, 1); }
  // contact shadow where a taller neighbour rises behind this tile
  const ao = (nx: number, ny: number, horizontal: boolean) => {
    if (effectiveTop(g, nx, ny) <= top + 0.1) return;
    const gr = horizontal ? ctx.createLinearGradient(x, 0, x + 0.45, 0) : ctx.createLinearGradient(0, y, 0, y + 0.45);
    gr.addColorStop(0, 'rgba(40,36,45,0.28)');
    gr.addColorStop(1, 'rgba(40,36,45,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, 1, 1);
  };
  ao(x - 1, y, true);
  ao(x, y - 1, false);
  topEdges(x, y, x + 1, y + 1, top, effectiveTop(g, x, y + 1) < top, effectiveTop(g, x + 1, y) < top);

  if (c.t === 'door') drawDoor(g, x, y, top);
}

function drawWater(g: Game, x: number, y: number, c: Cell, time: number) {
  const w = g.objsAt(x, y).find(o => o.kind === 'water')!;
  topSpace(c.top);
  ctx.fillStyle = '#163f8f';
  ctx.fillRect(x - 0.004, y - 0.004, 1.008, 1.008);
  ctx.fillStyle = pat('tex_water', 2, 2, time * 0.05, time * 0.03);
  ctx.globalAlpha = 0.95;
  ctx.fillRect(x - 0.004, y - 0.004, 1.008, 1.008);
  ctx.globalAlpha = 0.35;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = pat('tex_water', 3, 3, -time * 0.04, time * 0.02);
  ctx.fillRect(x, y, 1, 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (w.anim <= 0.01) return;
  // ice bridge rising out of the water
  const k = w.anim;
  const zi = c.top + (0 - c.top) * k;
  const iceTex = pat('tex_ice');
  const LT = effectiveTop(g, x, y + 1), RT = effectiveTop(g, x + 1, y);
  leftSpace(y + 1);
  if (LT < zi) face(x, 1, zi, Math.max(LT, c.top), iceTex, 0.1, 0.85 * k);
  rightSpace(x + 1);
  if (RT < zi) face(y, 1, zi, Math.max(RT, c.top), iceTex, 0.25, 0.85 * k);
  topSpace(zi);
  ctx.globalAlpha = 0.9 * k;
  ctx.fillStyle = iceTex;
  ctx.fillRect(x - 0.004, y - 0.004, 1.008, 1.008);
  ctx.globalAlpha = 0.25 * k;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#4aa8ff';
  ctx.fillRect(x, y, 1, 1);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  topEdges(x, y, x + 1, y + 1, zi, true, true, 0.7 * k);
}

function drawDoor(g: Game, x: number, y: number, top: number) {
  const open = g.doorOpen;
  leftSpace(y + 1);
  ctx.drawImage(assets[open ? 'decal_door_open' : 'decal_door_locked'], x + 0.06, -top * 0.94, 0.88, top * 0.94);
}

// ---- objects ---------------------------------------------------------------------------------

function sprite(key: string, cfg: SpriteCfg, x: number, y: number, z: number, flip = false, alpha = 1, squash = 0) {
  const img = assets[key];
  const p = W3(x + 0.5, y + 0.5, z);
  const s = cam.s;
  const w = cfg.w * TW * s * (1 + squash * 0.5);
  const h = (cfg.w * TW * s * img.height) / img.width * (1 - squash);
  const by = p.y + cfg.foot * cfg.w * TH / 2 * s + (cfg.dy ?? 0) * TH * s;
  screenSpace();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, by);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.globalAlpha = 1;
  screenSpace();
}

function blobShadow(x: number, y: number, z: number, r: number, a = 0.3) {
  const p = W3(x, y, z);
  screenSpace();
  const rr = r * TW * cam.s;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, 0.5);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
  gr.addColorStop(0, `rgba(25,22,32,${a})`);
  gr.addColorStop(1, 'rgba(25,22,32,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function glow(p: Pt, color: string, r: number, a: number) {
  screenSpace();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  gr.addColorStop(0, hexA(color, a));
  gr.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  ctx.restore();
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A free-standing block object (crate, ice wall) with full faces down to its base. */
function objBlock(x: number, y: number, z0: number, z1: number, inset: number, topFill: string | CanvasPattern, sideFill: string | CanvasPattern, alpha: number, decal?: string) {
  const a = x + inset, b = x + 1 - inset, c = y + inset, d = y + 1 - inset;
  leftSpace(d);
  face(a, b - a, z1, z0, sideFill, LEFT_SHADE, alpha);
  if (decal) { ctx.globalAlpha = alpha; ctx.drawImage(assets[decal], a, -z1, b - a, z1 - z0); ctx.fillStyle = `rgba(24,28,40,${LEFT_SHADE})`; ctx.fillRect(a, -z1, b - a, z1 - z0); }
  rightSpace(b);
  face(c, d - c, z1, z0, sideFill, RIGHT_SHADE, alpha);
  if (decal) { ctx.globalAlpha = alpha; ctx.drawImage(assets[decal], c, -z1, d - c, z1 - z0); ctx.fillStyle = `rgba(24,28,40,${RIGHT_SHADE})`; ctx.fillRect(c, -z1, d - c, z1 - z0); }
  topSpace(z1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = topFill;
  ctx.fillRect(a, c, b - a, d - c);
  ctx.globalAlpha = 1;
  topEdges(a, c, b, d, z1, true, true, 0.6 * alpha);
}

// Cells a tall object at (x, y) can cover on screen: the ones up to two rows behind it.
const BEHIND = [[-1, 0], [0, -1], [-1, -1], [-2, -1], [-1, -2], [-2, -2]];
const seeThrough = new Map<number, number>();

/** 1 normally; fades toward 0.35 while the object stands in front of water or the player. */
function occlusionAlpha(g: Game, o: Obj) {
  const hides = BEHIND.some(([a, b]) => {
    const x = o.x + a, y = o.y + b;
    if (Math.round(g.dx) === x && Math.round(g.dy) === y) return true;
    return g.objsAt(x, y).some(q => q.kind === 'water');
  });
  const cur = seeThrough.get(o.id) ?? 1;
  const next = cur + ((hides ? 0.35 : 1) - cur) * 0.15;
  seeThrough.set(o.id, next);
  return next;
}

function drawObj(g: Game, o: Obj, time: number) {
  const { x, y } = o;
  const z = o.kind === 'crystal' ? o.z : 0;
  const pulse = 0.75 + Math.sin(time * 2.4 + o.id) * 0.25;
  switch (o.kind) {
    case 'crystal': {
      blobShadow(x + 0.5, y + 0.5, z, 0.45, 0.25);
      sprite(`crystal_${o.color ?? 'empty'}`, SPRITE_CFG.crystal, x, y, z, false, occlusionAlpha(g, o));
      if (o.color) glow(W3(x + 0.5, y + 0.5, z + 0.8), HEX[o.color], 90 * cam.s, 0.3 * pulse * o.anim);
      break;
    }
    case 'crate': {
      if (o.anim <= 0.01) break;
      const k = o.anim;
      blobShadow(x + 0.5, y + 0.5, 0, 0.6, 0.3 * k);
      objBlock(x, y, -(1 - k) * 0.5, 1.05 * k - (1 - k) * 0.5 + 0.0, 0.1, pat('tex_floor'), '#ddd7ce', Math.min(1, k * 1.6) * occlusionAlpha(g, o), 'decal_crate');
      glow(W3(x + 0.5, y + 0.5, 0.5), HEX.red, 70 * cam.s, 0.18 * pulse * k + (1 - k) * k * 2);
      break;
    }
    case 'fire':
      blobShadow(x + 0.5, y + 0.5, 0, 0.45);
      sprite(o.anim > 0.5 ? 'brazier_on' : 'brazier_off', SPRITE_CFG.brazier, x, y, 0, false, occlusionAlpha(g, o));
      if (o.anim > 0.01) glow(W3(x + 0.5, y + 0.5, 1.2), HEX.red, 110 * cam.s, 0.4 * o.anim * (0.85 + Math.sin(time * 13 + o.id) * 0.15));
      break;
    case 'gen':
      blobShadow(x + 0.5, y + 0.5, 0, 0.55);
      sprite(o.anim > 0.5 ? 'generator_on' : 'generator_off', SPRITE_CFG.generator, x, y, 0, false, occlusionAlpha(g, o));
      if (o.anim > 0.01) glow(W3(x + 0.5, y + 0.5, 1.9), HEX.yellow, 100 * cam.s, 0.45 * o.anim * pulse);
      break;
    case 'lamp':
      blobShadow(x + 0.5, y + 0.5, 0, 0.35);
      sprite(o.anim > 0.5 ? 'lamp_on' : 'lamp_off', SPRITE_CFG.lamp, x, y, 0, false, occlusionAlpha(g, o));
      if (o.anim > 0.01) glow(W3(x + 0.5, y + 0.5, 2.2), HEX.yellow, 90 * cam.s, 0.45 * o.anim * pulse);
      break;
    case 'ice': {
      if (o.anim <= 0.01) break;
      const k = o.anim;
      objBlock(x, y, 0, 1.3 * k, 0.05, pat('tex_ice'), pat('tex_ice'), 0.82 * occlusionAlpha(g, o));
      glow(W3(x + 0.5, y + 0.5, 0.6 * k), HEX.blue, 80 * cam.s, 0.25 * k * pulse);
      break;
    }
    case 'laser':
      drawLaser(g, o, time);
      break;
  }
}

function drawLaser(g: Game, o: Obj, time: number) {
  const on = g.lampsOn;
  const isL = (x: number, y: number) => g.objsAt(x, y).some(q => q.kind === 'laser');
  const alongY = isL(o.x, o.y - 1) || isL(o.x, o.y + 1);
  const a = alongY ? [o.x + 0.5, o.y] : [o.x, o.y + 0.5];
  const b = alongY ? [o.x + 0.5, o.y + 1] : [o.x + 1, o.y + 0.5];
  const startCap = alongY ? !isL(o.x, o.y - 1) : !isL(o.x - 1, o.y);
  const endCap = alongY ? !isL(o.x, o.y + 1) : !isL(o.x + 1, o.y);
  // emitter posts at both ends of a run
  for (const [cap, p] of [[startCap, a], [endCap, b]] as const) {
    if (!cap) continue;
    const s = W3(p[0], p[1], 0), t = W3(p[0], p[1], 1.2);
    screenSpace();
    ctx.strokeStyle = '#5b5f6b';
    ctx.lineWidth = 8 * cam.s;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    if (on) glow(t, HEX.yellow, 26 * cam.s, 0.9);
  }
  if (!on) return;
  screenSpace();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const z of [0.3, 0.65, 1.0]) {
    const s = W3(a[0], a[1], z), t = W3(b[0], b[1], z);
    const flick = 0.8 + Math.sin(time * 30 + z * 10) * 0.2;
    ctx.strokeStyle = hexA(HEX.yellow, 0.35 * flick);
    ctx.lineWidth = 9 * cam.s;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,220,0.95)';
    ctx.lineWidth = 2 * cam.s;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWires(g: Game, time: number) {
  const door = g.objs.find(o => o.kind === 'door');
  if (!door) return;
  for (const gen of g.objs.filter(o => o.kind === 'gen')) {
    // run along the floor; a generator set into the back wall first drops to the row in front of it
    const midY = gen.y >= door.y + 1 ? gen.y + 0.5 : door.y + 1.5;
    const pts = [W3(gen.x + 0.5, gen.y + 0.5, 0.02), W3(gen.x + 0.5, midY, 0.02), W3(door.x + 0.5, midY, 0.02), W3(door.x + 0.5, door.y + 1, 0.02)];
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
    screenSpace();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(110,100,80,0.45)';
    ctx.lineWidth = 9 * cam.s;
    path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,135,95,0.8)';
    ctx.lineWidth = 3.5 * cam.s;
    path(); ctx.stroke();
    if (gen.anim <= 0.01) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = gen.anim;
    ctx.strokeStyle = hexA(HEX.yellow, 0.35);
    ctx.lineWidth = 12 * cam.s;
    path(); ctx.stroke();
    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 4 * cam.s;
    path(); ctx.stroke();
    ctx.setLineDash([10 * cam.s, 30 * cam.s]);
    ctx.lineDashOffset = -time * 80 * cam.s;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5 * cam.s;
    path(); ctx.stroke();
    ctx.restore();
  }
}

/** Coloured light spilling onto the floor around active objects and the player. */
function lightPools(g: Game) {
  const pool = (x: number, y: number, z: number, color: string, r: number, a: number) => {
    const p = W3(x, y, z);
    screenSpace();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(p.x, p.y);
    ctx.scale(1, 0.5);
    const rr = r * TW * cam.s;
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    gr.addColorStop(0, hexA(color, a));
    gr.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
    ctx.restore();
  };
  for (const o of g.objs) {
    if (o.kind === 'crystal' && o.color) pool(o.x + 0.5, o.y + 0.5, 0, HEX[o.color], 1.6, 0.22 * o.anim);
    if (o.kind === 'fire' && o.color) pool(o.x + 0.5, o.y + 0.5, 0, HEX.red, 1.5, 0.25 * o.anim);
    if ((o.kind === 'gen' || o.kind === 'lamp') && o.anim > 0) pool(o.x + 0.5, o.y + 0.5, 0, HEX.yellow, 1.3, 0.2 * o.anim);
    if (o.kind === 'ice' && o.anim > 0) pool(o.x + 0.5, o.y + 0.5, 0, HEX.blue, 1.1, 0.14 * o.anim);
    if (o.kind === 'water' && o.anim > 0) pool(o.x + 0.5, o.y + 0.5, 0, HEX.blue, 0.9, 0.16 * o.anim);
    if (o.kind === 'door' && g.doorOpen) pool(o.x + 0.5, o.y + 1.2, 0, '#ffe7a0', 1.1, 0.25);
  }
  if (g.carry) pool(g.dx + 0.5, g.dy + 0.5, 0, HEX[g.carry], 1.0, 0.2);
}

// ---- background -------------------------------------------------------------------------------

function drawBackground(time: number) {
  screenSpace();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const gr = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.7);
  gr.addColorStop(0, 'rgba(60,68,86,0.45)');
  gr.addColorStop(1, 'rgba(20,23,30,0.5)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  // drifting ruins in the void
  const ruin = (fx: number, fy: number, sc: number, arch: boolean, phase: number) => {
    const x = fx * W, y = fy * H + Math.sin(time * 0.4 + phase) * 4;
    const u = 26 * sc;
    const col = (dx: number, w: number, h: number) => {
      ctx.fillStyle = '#2c313c';
      ctx.fillRect(x + dx, y - h, w, h);
      ctx.fillStyle = '#323844';
      ctx.fillRect(x + dx, y - h, w, u * 0.25);
    };
    if (arch) {
      col(-2 * u, u * 0.9, 4 * u);
      col(1.1 * u, u * 0.9, 4 * u);
      ctx.fillStyle = '#2c313c';
      ctx.beginPath();
      ctx.moveTo(-2 * u + x, y - 4 * u);
      ctx.lineTo(2 * u + x, y - 4 * u);
      ctx.lineTo(2 * u + x, y - 5 * u);
      ctx.lineTo(-2 * u + x, y - 5 * u);
      ctx.fill();
    } else col(-u / 2, u * 1.2, u * 1.4);
  };
  ruin(0.06, 1.02, 1.6, true, 0);
  ruin(0.94, 1.03, 1.7, true, 2);
  ruin(0.2, 0.92, 1, false, 1);
  ruin(0.84, 0.18, 0.7, false, 3);
}

function vignette() {
  screenSpace();
  const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  gr.addColorStop(0, 'rgba(10,12,18,0)');
  gr.addColorStop(1, 'rgba(10,12,18,0.55)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
}

// ---- frame --------------------------------------------------------------------------------------

export function playerChest(g: Game): Pt {
  return iso(g.dx + 0.5, g.dy + 0.5, 0.75 + g.hop);
}

export function draw(g: Game, fx: FX, time: number) {
  if (fitW !== W || fitH !== H) fitCamera(g);
  cam.s = base.s;
  cam.ox = base.ox + (Math.random() - 0.5) * fx.shake;
  cam.oy = base.oy + Math.sin(time * 0.8) * 3 + (Math.random() - 0.5) * fx.shake;

  drawBackground(time);

  // pass 1: everything at or below floor level
  const flat: [number, number, Cell][] = [];
  const tall: { k: number; o: number; f: () => void }[] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.cell(x, y);
    if (!c) continue;
    if (c.top <= 0) flat.push([x, y, c]);
    else tall.push({ k: x + y, o: 0, f: () => drawCell(g, x, y, c, time) });
  }
  flat.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [x, y, c] of flat) drawCell(g, x, y, c, time);
  drawWires(g, time);
  lightPools(g);
  if (!hover?.obj) drawHover(g, time);

  // pass 2: depth-sorted raised terrain, objects and the player
  for (const o of g.objs) {
    if (o.kind === 'water' || o.kind === 'door') continue;
    tall.push({ k: o.x + o.y, o: 1, f: () => drawObj(g, o, time) });
  }
  tall.push({ k: g.dx + g.dy, o: 2, f: () => drawPlayer(g, time) });
  tall.sort((a, b) => a.k - b.k || a.o - b.o);
  for (const it of tall) it.f();
  if (hover?.obj) drawHover(g, time); // objects can stand on raised blocks, so outline them on top

  // aim preview: a faint ribbon from the player to whatever the next action would touch
  const it = g.intent();
  screenSpace();
  if (it && !g.busy) {
    const tp = iso(it.obj.x + 0.5, it.obj.y + 0.5, (it.obj.kind === 'crystal' ? it.obj.z : 0) + 0.6);
    const pc = playerChest(g);
    const color = HEX[it.action === 'inject' ? g.carry! : it.obj.color!];
    const [a, b] = it.action === 'inject' ? [pc, tp] : [tp, pc];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ribbon(ctx, a, b, 0, 1, color, time, toScreen, cam.s, 0.35 + Math.sin(time * 4) * 0.12);
    ctx.restore();
  }
  screenSpace();
  fx.draw(ctx, toScreen, cam.s);
  vignette();
}

function drawPlayer(g: Game, time: number) {
  const fade = g.won ? Math.max(0, 1 - g.winT * 2.2) : 1;
  const breathe = Math.sin(time * 3) * 0.02;
  blobShadow(g.dx + 0.5, g.dy + 0.5, 0, 0.28, 0.35 * fade);
  // sprite art faces down-right; mirror when heading left on screen
  const flip = g.face === 1 || g.face === 2;
  sprite(`player_${g.carry ?? 'none'}`, SPRITE_CFG.player, g.dx, g.dy, g.hop, flip, fade, breathe + (g.hop > 0 ? -0.04 : 0));
  if (g.carry) glow(toScreen(playerChest(g)), HEX[g.carry], 46 * cam.s, 0.35);
}

/** The cell or object under the pointer, outlined so click targets are obvious. */
export let hover: { x: number; y: number; obj?: Obj } | null = null;
export function setHover(h: typeof hover) { hover = h; }

function drawHover(g: Game, time: number) {
  if (!hover || g.won) return;
  const { x, y, obj } = hover;
  const c = g.cell(x, y);
  if (!c) return;
  let color = 'rgba(255,255,255,';
  if (obj) {
    const act = g.carry ? g.accepts(obj, g.carry) : g.canExtract(obj);
    const col = g.carry ?? obj.color;
    color = act && col ? hexA(HEX[col], 1).replace(/,1\)$/, ',') : 'rgba(255,255,255,';
  } else if (!g.walkable(x, y)) return;
  const z = obj?.kind === 'crystal' ? obj.z : c.t === 'water' && obj?.color !== 'blue' ? c.top : Math.min(c.top, 0);
  const a = 0.55 + Math.sin(time * 5) * 0.2;
  topSpace(z + 0.01);
  ctx.fillStyle = `${color}${0.1 * a})`;
  ctx.fillRect(x + 0.06, y + 0.06, 0.88, 0.88);
  ctx.strokeStyle = `${color}${a})`;
  ctx.lineWidth = 0.035;
  ctx.strokeRect(x + 0.06, y + 0.06, 0.88, 0.88);
}

/** Screen point -> object or floor cell under it. */
export function pick(g: Game, sx: number, sy: number): { obj?: Obj; x: number; y: number } | null {
  let best: { obj: Obj; d: number } | null = null;
  for (const o of g.objs) {
    if (o.kind === 'water' || o.kind === 'laser' || (o.kind === 'crate' && o.gone)) continue;
    const z = o.kind === 'door' ? 1 : (o.kind === 'crystal' ? o.z : 0) + 0.6;
    const c = o.kind === 'door' ? W3(o.x + 0.5, o.y + 1, z) : W3(o.x + 0.5, o.y + 0.5, z);
    const d = Math.hypot(sx - c.x, (sy - c.y) * 0.8);
    if (d < 0.42 * TW * cam.s && (!best || d < best.d)) best = { obj: o, d };
  }
  if (best && best.obj.kind !== 'door') return { obj: best.obj, x: best.obj.x, y: best.obj.y };
  if (best) return { x: best.obj.x, y: best.obj.y };
  const wx = (sx - cam.ox) / cam.s, wy = (sy - cam.oy) / cam.s;
  const gx = Math.floor((wy / (TH / 2) + wx / (TW / 2)) / 2);
  const gy = Math.floor((wy / (TH / 2) - wx / (TW / 2)) / 2);
  if (!g.cell(gx, gy)) return null;
  const water = g.objsAt(gx, gy).find(o => o.kind === 'water');
  return water && !g.walkable(gx, gy) ? { obj: water, x: gx, y: gy } : { x: gx, y: gy };
}

