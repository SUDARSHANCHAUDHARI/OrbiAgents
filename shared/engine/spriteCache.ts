import type { SpriteData } from "../types";

const zoomCaches = new Map<number, WeakMap<SpriteData, HTMLCanvasElement>>();

export function getCachedSprite(sprite: SpriteData, zoom: number): HTMLCanvasElement {
  let cache = zoomCaches.get(zoom);
  if (!cache) { cache = new WeakMap(); zoomCaches.set(zoom, cache); }
  const hit = cache.get(sprite);
  if (hit) return hit;

  const rows = sprite.length;
  const cols = rows > 0 ? sprite[0].length : 0;
  const cv = document.createElement("canvas");
  cv.width  = Math.max(1, cols * zoom);
  cv.height = Math.max(1, rows * zoom);
  const cx = cv.getContext("2d")!;
  cx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = sprite[r][c];
      if (!color) continue;
      cx.fillStyle = color;
      cx.fillRect(c * zoom, r * zoom, zoom, zoom);
    }
  }
  cache.set(sprite, cv);
  return cv;
}

export function getOutlineSprite(sprite: SpriteData): SpriteData {
  const rows = sprite.length;
  const cols = rows > 0 ? sprite[0].length : 0;
  const out: string[][] = Array.from({ length: rows + 2 }, () =>
    new Array<string>(cols + 2).fill("")
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!sprite[r][c]) continue;
      const er = r + 1, ec = c + 1;
      if (!out[er - 1][ec]) out[er - 1][ec] = "#FFFFFF";
      if (!out[er + 1][ec]) out[er + 1][ec] = "#FFFFFF";
      if (!out[er][ec - 1]) out[er][ec - 1] = "#FFFFFF";
      if (!out[er][ec + 1]) out[er][ec + 1] = "#FFFFFF";
    }
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (sprite[r][c]) out[r + 1][c + 1] = "";
  return out;
}

export function flipHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map(row => [...row].reverse());
}
