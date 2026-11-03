// Isometric projection. Grid +x runs screen down-right, +y runs screen down-left, z is up.
export const TW = 128; // tile width in world px
export const TH = 64; // tile height in world px
export const ZU = 52; // px per height unit

// 0:+x (down-right) 1:+y (down-left) 2:-x (up-left) 3:-y (up-right)
export const DIRS: readonly [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function iso(x: number, y: number, z = 0) {
  return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * ZU };
}
