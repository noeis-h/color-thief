import { placeholder } from './placeholders';

export type Img = HTMLCanvasElement | HTMLImageElement;

// How each kind of art is used:
//   tex   – seamless texture tiled across terrain faces (covers 2x2 cells / 2 cells x 2 height units)
//   decal – flat front-on image stretched onto one block face (door, crate panels)
//   sprite – isometric cut-out standing on a tile; background removed and trimmed automatically
type Use = 'tex' | 'decal' | 'sprite';

export const MANIFEST: Record<string, Use> = {
  tex_floor: 'tex',
  tex_wall: 'tex',
  tex_water: 'tex',
  tex_ice: 'tex',
  decal_door_locked: 'decal',
  decal_door_open: 'decal',
  decal_crate: 'decal',
  player_none: 'sprite',
  player_red: 'sprite',
  player_blue: 'sprite',
  player_yellow: 'sprite',
  crystal_red: 'sprite',
  crystal_blue: 'sprite',
  crystal_yellow: 'sprite',
  crystal_empty: 'sprite',
  generator_off: 'sprite',
  generator_on: 'sprite',
  lamp_on: 'sprite',
  lamp_off: 'sprite',
  brazier_on: 'sprite',
  brazier_off: 'sprite',
};

// Sprite placement. w = drawn width in tile widths; foot = how far below the tile centre the
// sprite's bottom edge sits (1 = front corner of a footprint w wide); dy = extra nudge in tile heights.
export interface SpriteCfg { w: number; foot: number; dy?: number }
export const SPRITE_CFG: Record<string, SpriteCfg> = {
  player: { w: 0.8, foot: 0, dy: 0.1 },
  crystal: { w: 0.82, foot: 0.62 },
  generator: { w: 0.96, foot: 0.95 },
  lamp: { w: 0.5, foot: 0.9 },
  brazier: { w: 0.88, foot: 0.95 },
};

export const assets: Record<string, Img> = {};
export const custom = new Set<string>();

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Removes a flat chroma-green (or already-transparent) background and trims to content. */
function cleanup(img: Img, trim: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  const at = (x: number, y: number) => (y * c.width + x) * 4;
  const corners = [at(0, 0), at(c.width - 1, 0), at(0, c.height - 1), at(c.width - 1, c.height - 1)];
  const greenBg = corners.every(i => p[i + 3] > 200 && p[i + 1] > 140 && p[i + 1] > p[i] * 1.5 && p[i + 1] > p[i + 2] * 1.5);
  if (greenBg) {
    for (let i = 0; i < p.length; i += 4) {
      const spill = p[i + 1] - Math.max(p[i], p[i + 2]);
      if (spill > 70) p[i + 3] = 0;
      else if (spill > 18) {
        p[i + 3] = Math.round(p[i + 3] * (1 - (spill - 18) / 52));
        p[i + 1] = Math.max(p[i], p[i + 2]);
      }
    }
    g.putImageData(data, 0, 0);
  }
  if (!trim) return c;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (p[at(x, y) + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) return c;
  const t = document.createElement('canvas');
  t.width = x1 - x0 + 1;
  t.height = y1 - y0 + 1;
  t.getContext('2d')!.drawImage(c, -x0, -y0);
  return t;
}

const srcCache = new Map<string, string>();

/** A small image URL for an asset, for use in HTML (the how-to-play guide). */
export function assetSrc(key: string) {
  let src = srcCache.get(key);
  if (!src) {
    const img = assets[key];
    const k = Math.min(1, 320 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    src = c.toDataURL();
    srcCache.set(key, src);
  }
  return src;
}

/** Loads /assets/<key>.png|webp|jpg when present, otherwise falls back to a drawn placeholder. */
export async function loadAssets() {
  await Promise.all(Object.entries(MANIFEST).map(async ([key, use]) => {
    for (const ext of ['png', 'webp', 'jpg']) {
      try {
        const img = await loadImage(`${import.meta.env.BASE_URL}assets/${key}.${ext}`);
        assets[key] = use === 'tex' ? img : cleanup(img, use === 'sprite');
        custom.add(key);
        return;
      } catch { /* try next extension */ }
    }
    const ph = placeholder(key);
    assets[key] = use === 'sprite' ? cleanup(ph, true) : ph;
  }));
  const missing = Object.keys(MANIFEST).filter(k => !custom.has(k));
  if (missing.length) console.info(`[assets] using placeholders for: ${missing.join(', ')}`);
}
