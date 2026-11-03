// Stand-in art drawn in code, used only until the generated image for a key is dropped into public/assets.

type G = CanvasRenderingContext2D;

const PAL: Record<string, [string, string, string]> = {
  red: ['#ff9a86', '#ec3b30', '#9e1219'],
  blue: ['#a6d6ff', '#3b8ff0', '#1a4ea6'],
  yellow: ['#fff2a4', '#ffcc2e', '#c48700'],
  empty: ['#dfe1e6', '#aeb2bc', '#7d828e'],
  none: ['#b8bdc8', '#8d93a0', '#5f6572'],
};

function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function poly(g: G, pts: number[][], fill: string) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

/** Isometric box; (cx, by) is the centre of the bottom diamond. */
function box(g: G, cx: number, by: number, hw: number, hgt: number, top: string, left: string, right: string) {
  const hh = hw / 2, ty = by - hgt;
  poly(g, [[cx - hw, ty], [cx, ty + hh], [cx, by + hh], [cx - hw, by]], left);
  poly(g, [[cx, ty + hh], [cx + hw, ty], [cx + hw, by], [cx, by + hh]], right);
  poly(g, [[cx, ty - hh], [cx + hw, ty], [cx, ty + hh], [cx - hw, ty]], top);
}

function stoneTex(seed: number, rows: number, cols: number, offsetRows: boolean, base: number) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#bdb6ab';
  g.fillRect(0, 0, 512, 512);
  const ch = 512 / rows;
  for (let y = 0; y < rows; y++) {
    const cw = 512 / cols;
    const off = offsetRows && y % 2 ? cw / 2 : 0;
    for (let x = -1; x < cols; x++) {
      const v = base + (r() - 0.5) * 10;
      const x0 = x * cw + off + 2, y0 = y * ch + 2, w = cw - 4, h = ch - 4;
      g.fillStyle = `hsl(38, 10%, ${v}%)`;
      g.fillRect(x0, y0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x0, y0, w, 3);
      g.fillRect(x0, y0, 3, h);
      g.fillStyle = 'rgba(80,70,60,0.14)';
      g.fillRect(x0, y0 + h - 4, w, 4);
      g.fillRect(x0 + w - 4, y0, 4, h);
    }
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,50,40,0.06)';
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  return c;
}

function waterTex(ice: boolean) {
  const [c, g] = canvas(512, 512);
  const r = rng(ice ? 7 : 3);
  g.fillStyle = ice ? '#9fd4fb' : '#2160c8';
  g.fillRect(0, 0, 512, 512);
  g.lineCap = 'round';
  for (let i = 0; i < (ice ? 26 : 70); i++) {
    const x = r() * 512, y = r() * 512, len = 30 + r() * 90, a = r() * Math.PI;
    g.strokeStyle = ice ? 'rgba(255,255,255,0.55)' : `rgba(110,180,255,${0.25 + r() * 0.35})`;
    g.lineWidth = ice ? 1.5 : 3 + r() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 1) * len * 0.6, y + Math.sin(a + 1) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      g.save(); g.translate(ox, oy); g.stroke(); g.restore();
    }
  }
  if (ice) {
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    g.strokeRect(258, 258, 252, 252);
    g.strokeRect(258, 2, 252, 252);
    g.strokeRect(2, 258, 252, 252);
  }
  return c;
}

function door(open: boolean) {
  const [c, g] = canvas(512, 768);
  const arch = (inset: number) => {
    const l = 96 + inset, rgt = 416 - inset, top = 230 + inset, bottom = 768;
    g.beginPath();
    g.moveTo(l, bottom);
    g.lineTo(l, top);
    g.arc(256, top, 160 - inset, Math.PI, 0);
    g.lineTo(rgt, bottom);
    g.closePath();
  };
  arch(-46);
  g.fillStyle = '#ddd7ce';
  g.fill();
  g.strokeStyle = '#b9b1a5';
  g.lineWidth = 4;
  g.stroke();
  arch(0);
  if (open) {
    const gr = g.createLinearGradient(0, 100, 0, 768);
    gr.addColorStop(0, '#fff7da');
    gr.addColorStop(1, '#ffd77a');
    g.fillStyle = gr;
  } else g.fillStyle = '#3b3e47';
  g.fill();
  if (!open) {
    g.strokeStyle = '#30333b';
    g.lineWidth = 5;
    for (let x = 150; x < 400; x += 54) { g.beginPath(); g.moveTo(x, 120); g.lineTo(x, 768); g.stroke(); }
  }
  arch(14);
  g.shadowColor = '#ffd23d';
  g.shadowBlur = 24;
  g.strokeStyle = open ? 'rgba(255,240,190,0.9)' : '#ffcf3a';
  g.lineWidth = 9;
  g.stroke();
  g.shadowBlur = 0;
  // keystone diamond
  poly(g, [[256, 18], [282, 52], [256, 86], [230, 52]], open ? '#ffe9a0' : '#ffd23d');
  if (!open) {
    g.shadowColor = '#ffd23d';
    g.shadowBlur = 18;
    g.strokeStyle = '#ffd23d';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(256, 420, 36, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#ffd23d';
    g.fillRect(206, 418, 100, 82);
    g.shadowBlur = 0;
    g.fillStyle = '#3b3e47';
    g.beginPath();
    g.arc(256, 450, 11, 0, Math.PI * 2);
    g.fill();
    g.fillRect(251, 452, 10, 30);
  }
  return c;
}

function crateDecal() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#e2ddd4';
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#cfc8bd';
  g.fillRect(40, 40, 432, 432);
  g.fillStyle = '#7d1a1c';
  g.fillRect(96, 96, 320, 320);
  g.shadowColor = '#ff4b3e';
  g.shadowBlur = 30;
  g.strokeStyle = '#ff5a48';
  g.lineWidth = 10;
  g.strokeRect(110, 110, 292, 292);
  // flame glyph
  g.fillStyle = '#ff6a50';
  g.beginPath();
  g.moveTo(256, 150);
  g.bezierCurveTo(330, 230, 350, 300, 256, 360);
  g.bezierCurveTo(160, 300, 190, 230, 226, 210);
  g.bezierCurveTo(226, 250, 240, 270, 256, 280);
  g.bezierCurveTo(250, 230, 250, 190, 256, 150);
  g.fill();
  g.shadowBlur = 0;
  return c;
}

function crystal(kind: string) {
  const [c, g] = canvas(256, 300);
  const [lt, md, dk] = PAL[kind];
  box(g, 128, 262, 86, 16, '#6b5a57', '#4d4040', '#3b3031');
  box(g, 128, 248, 66, 8, '#7b6865', '#5a4b4b', '#463a3b');
  const shards: [number, number, number, number][] = [
    [-8, 150, 22, 6], [26, 112, 18, 16], [-40, 96, 16, -14], [44, 70, 13, 20], [-58, 54, 12, -18], [6, 64, 14, 4],
  ];
  if (kind === 'empty') g.globalAlpha = 0.85;
  for (const [dx, h, w, tilt] of shards) {
    const x = 128 + dx, by = 236 + Math.abs(dx) * 0.12;
    const tipX = x + tilt, tipY = by - h - w * 1.3;
    poly(g, [[x - w, by], [x - w + tilt, by - h], [tipX, tipY], [x, by + w * 0.35]], lt);
    poly(g, [[x, by + w * 0.35], [tipX, tipY], [x + w + tilt, by - h], [x + w, by]], md);
    poly(g, [[x + w * 0.35, by + w * 0.2], [tipX + 2, tipY + 8], [x + w + tilt, by - h], [x + w, by]], dk);
  }
  return c;
}

function generator(on: boolean) {
  const [c, g] = canvas(256, 400);
  box(g, 128, 330, 104, 120, '#ece8e1', '#dcd6cd', '#bdb6ab');
  // bolt panel on the left face
  g.save();
  g.setTransform(1, 0.5, 0, 1, 24, 210);
  g.fillStyle = '#4a4d55';
  g.fillRect(22, 26, 60, 72);
  g.fillStyle = on ? '#ffd23d' : '#8f8a7a';
  if (on) { g.shadowColor = '#ffd23d'; g.shadowBlur = 14; }
  poly(g, [[56, 34], [38, 64], [52, 64], [44, 90], [68, 56], [54, 56], [64, 34]], g.fillStyle as string);
  g.restore();
  box(g, 128, 210, 74, 18, '#d8d2c8', '#c4bdb2', '#a8a196');
  // glowing core inside a cage
  const coreTop = 92, coreBot = 192;
  const gr = g.createLinearGradient(80, 0, 176, 0);
  gr.addColorStop(0, on ? '#fff3b0' : '#c7c4ba');
  gr.addColorStop(1, on ? '#ffbf1f' : '#8f8c84');
  g.fillStyle = gr;
  if (on) { g.shadowColor = '#ffd23d'; g.shadowBlur = 40; }
  g.beginPath();
  g.ellipse(128, coreBot, 40, 20, 0, 0, Math.PI);
  g.lineTo(88, coreTop);
  g.ellipse(128, coreTop, 40, 20, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = on ? '#c99a1a' : '#7c776c';
  g.lineWidth = 5;
  for (const dx of [-46, -24, 0, 24, 46]) {
    g.beginPath();
    g.moveTo(128 + dx, coreTop - 8 + Math.abs(dx) * 0.3);
    g.lineTo(128 + dx, coreBot + 14 - Math.abs(dx) * 0.3);
    g.stroke();
  }
  for (const y of [coreTop - 6, coreBot + 4]) {
    g.beginPath(); g.ellipse(128, y, 50, 22, 0, 0, Math.PI * 2); g.stroke();
  }
  box(g, 128, coreTop - 18, 30, 12, '#8c6f22', '#6d561a', '#584514');
  g.fillStyle = '#6d561a';
  g.fillRect(124, 40, 8, 40);
  return c;
}

function lamp(on: boolean) {
  const [c, g] = canvas(192, 400);
  box(g, 96, 350, 50, 22, '#e4dfd7', '#cfc8be', '#b2ab9f');
  box(g, 96, 330, 18, 170, '#ddd7ce', '#c8c1b6', '#a9a297');
  box(g, 96, 160, 40, 10, '#6d561a', '#5a4715', '#4a3a11');
  const gr = g.createRadialGradient(96, 115, 4, 96, 115, 46);
  gr.addColorStop(0, on ? '#fffbe0' : '#b9b7ae');
  gr.addColorStop(1, on ? '#ffc21f' : '#7d7a72');
  if (on) { g.shadowColor = '#ffd23d'; g.shadowBlur = 40; }
  g.fillStyle = gr;
  g.fillRect(66, 72, 60, 82);
  g.shadowBlur = 0;
  g.strokeStyle = '#5a4715';
  g.lineWidth = 6;
  g.strokeRect(66, 72, 60, 82);
  g.beginPath(); g.moveTo(96, 72); g.lineTo(96, 154); g.stroke();
  poly(g, [[56, 74], [96, 40], [136, 74]], '#6d561a');
  return c;
}

function brazier(on: boolean) {
  const [c, g] = canvas(256, 340);
  box(g, 128, 290, 70, 46, '#e4dfd7', '#cfc8be', '#b2ab9f');
  g.fillStyle = '#4a3e3d';
  g.beginPath();
  g.ellipse(128, 236, 92, 40, 0, 0, Math.PI);
  g.lineTo(220, 222);
  g.ellipse(128, 222, 92, 40, 0, 0, Math.PI, true);
  g.fill();
  g.fillStyle = on ? '#ff7a3a' : '#5b5352';
  g.beginPath(); g.ellipse(128, 222, 84, 34, 0, 0, Math.PI * 2); g.fill();
  if (!on) return c;
  const flame = (w: number, h: number, col: string, dx: number) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(128 + dx - w, 224);
    g.bezierCurveTo(128 + dx - w, 180, 128 + dx - w * 0.2, 170, 128 + dx, 224 - h);
    g.bezierCurveTo(128 + dx + w * 0.4, 170, 128 + dx + w, 180, 128 + dx + w, 224);
    g.fill();
  };
  g.shadowColor = '#ff4b3e';
  g.shadowBlur = 30;
  flame(70, 170, '#e8392f', 0);
  flame(48, 130, '#ff7a3a', 8);
  flame(26, 80, '#ffd77a', 4);
  return c;
}

function player(col: string) {
  const [c, g] = canvas(200, 300);
  const [lt, md, dk] = PAL[col];
  g.fillStyle = '#26222a';
  g.beginPath(); g.ellipse(80, 286, 15, 9, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(118, 288, 15, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(70, 252, 18, 34);
  g.fillRect(110, 254, 18, 34);
  // cloak
  const cg = g.createLinearGradient(50, 0, 160, 0);
  cg.addColorStop(0, '#fbfaf7');
  cg.addColorStop(1, '#d9d5ce');
  g.fillStyle = cg;
  g.beginPath();
  g.moveTo(100, 110);
  g.bezierCurveTo(60, 130, 52, 220, 46, 262);
  g.quadraticCurveTo(100, 276, 154, 262);
  g.bezierCurveTo(148, 220, 140, 130, 100, 110);
  g.fill();
  // hood
  g.beginPath();
  g.moveTo(100, 18);
  g.bezierCurveTo(158, 22, 166, 96, 146, 142);
  g.quadraticCurveTo(100, 160, 54, 142);
  g.bezierCurveTo(34, 96, 42, 22, 100, 18);
  g.fill();
  g.fillStyle = '#211d24';
  g.beginPath(); g.ellipse(102, 96, 34, 38, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffe9c9';
  g.shadowColor = '#ffd9a0';
  g.shadowBlur = 10;
  g.beginPath(); g.ellipse(88, 98, 6, 8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(116, 98, 6, 8, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  // scarf: wrap + tail streaming to the left
  g.fillStyle = md;
  g.beginPath();
  g.moveTo(54, 140); g.quadraticCurveTo(100, 166, 148, 140);
  g.lineTo(150, 160); g.quadraticCurveTo(100, 186, 52, 160);
  g.fill();
  g.fillStyle = dk;
  g.beginPath();
  g.moveTo(62, 152);
  g.bezierCurveTo(30, 162, 26, 196, 2, 214);
  g.bezierCurveTo(30, 214, 50, 196, 72, 176);
  g.fill();
  g.fillStyle = lt;
  g.globalAlpha = 0.6;
  g.fillRect(70, 150, 60, 4);
  g.globalAlpha = 1;
  return c;
}

export function placeholder(key: string): HTMLCanvasElement {
  switch (key) {
    case 'tex_floor': return stoneTex(11, 4, 4, false, 88);
    case 'tex_wall': return stoneTex(23, 8, 4, true, 84);
    case 'tex_water': return waterTex(false);
    case 'tex_ice': return waterTex(true);
    case 'decal_door_locked': return door(false);
    case 'decal_door_open': return door(true);
    case 'decal_crate': return crateDecal();
    case 'generator_on': return generator(true);
    case 'generator_off': return generator(false);
    case 'lamp_on': return lamp(true);
    case 'lamp_off': return lamp(false);
    case 'brazier_on': return brazier(true);
    case 'brazier_off': return brazier(false);
  }
  if (key.startsWith('crystal_')) return crystal(key.slice(8));
  if (key.startsWith('player_')) return player(key.slice(7));
  return canvas(4, 4)[0];
}
