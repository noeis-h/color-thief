// Particles, colour streams and ripple rings. Positions are unscaled world px (see iso()).

export interface Pt { x: number; y: number }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface Stream { a: Pt; b: Pt; color: string; t: number; dur: number }
interface Ring { p: Pt; color: string; t: number; dur: number; r: number }

export class FX {
  parts: Particle[] = [];
  streams: Stream[] = [];
  rings: Ring[] = [];
  shake = 0;

  burst(p: Pt, color: string, n = 24, speed = 140, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 40, life: 0, max: 0.5 + Math.random() * 0.6, color, size: size * (0.5 + Math.random()), grav: 120 });
    }
  }

  mote(p: Pt, color: string, spread = 30) {
    this.parts.push({ x: p.x + (Math.random() - 0.5) * spread, y: p.y + (Math.random() - 0.5) * spread * 0.5, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 30, life: 0, max: 1.2 + Math.random(), color, size: 1.5 + Math.random() * 2, grav: 0 });
  }

  stream(a: Pt, b: Pt, color: string, dur = 0.55) {
    this.streams.push({ a, b, color, t: 0, dur });
  }

  ring(p: Pt, color: string, r = 70, dur = 0.6) {
    this.rings.push({ p, color, t: 0, dur, r });
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - dt * 1.5;
    }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const s of this.streams) {
      s.t += dt;
      const h = streamPoint(s.a, s.b, Math.min(1, s.t / s.dur), s.t);
      for (let i = 0; i < 2; i++) this.mote(h, s.color, 14);
    }
    this.streams = this.streams.filter(s => s.t < s.dur + 0.35);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.dur);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  draw(ctx: CanvasRenderingContext2D, toScreen: (p: Pt) => Pt, s: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const k = r.t / r.dur, c = toScreen(r.p);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * s * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r.r * s * (0.2 + k), r.r * s * (0.2 + k) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const st of this.streams) {
      const head = Math.min(1, st.t / st.dur);
      const tail = Math.max(0, (st.t - 0.25) / st.dur);
      ribbon(ctx, st.a, st.b, tail, head, st.color, st.t, toScreen, s, Math.min(1, (st.dur + 0.35 - st.t) * 3));
    }
    for (const p of this.parts) {
      const k = p.life / p.max, c = toScreen(p);
      ctx.globalAlpha = (1 - k) * 0.95;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(0.5, p.size * s * (1 - k * 0.6)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** A point along a lifted, gently waving arc from a to b. */
export function streamPoint(a: Pt, b: Pt, u: number, time: number): Pt {
  const lift = 50 + Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
  const x = a.x + (b.x - a.x) * u;
  const y = a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * lift;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const wave = Math.sin(u * 9 - time * 6) * 9 * Math.sin(Math.PI * u);
  return { x: x - ((b.y - a.y) / len) * wave, y: y + ((b.x - a.x) / len) * wave };
}

export function ribbon(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, u0: number, u1: number, color: string, time: number, toScreen: (p: Pt) => Pt, s: number, alpha = 1) {
  if (u1 - u0 < 0.01) return;
  const pts: Pt[] = [];
  for (let i = 0; i <= 28; i++) pts.push(toScreen(streamPoint(a, b, u0 + (u1 - u0) * (i / 28), time)));
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22 * alpha;
  ctx.lineWidth = 12 * s;
  path(); ctx.stroke();
  ctx.globalAlpha = 0.55 * alpha;
  ctx.lineWidth = 4.5 * s;
  path(); ctx.stroke();
  ctx.globalAlpha = 0.9 * alpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2 * s;
  path(); ctx.stroke();
}
