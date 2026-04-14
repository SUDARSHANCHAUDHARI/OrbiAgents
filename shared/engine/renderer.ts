import type { CharacterRenderState, FurnitureInstance } from "../types";
import { CharacterState, Direction, TileType } from "../types";
import { getCachedSprite, getOutlineSprite } from "./spriteCache";
import { getFloorColor, TILE_SIZE } from "./tileMap";
import { getCharacterSprites, type CharacterSprites } from "../sprites/characters";
import type { SpriteData } from "../types";

const CHAR_W = 16;
const CHAR_H = 26;

interface ZDrawable {
  zY: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  tileMap: TileType[][],
  furniture: FurnitureInstance[],
  characters: CharacterRenderState[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const TS = TILE_SIZE * zoom;
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;

  // 1. Floor tiles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = tileMap[r][c];
      if (tile === TileType.VOID || tile === TileType.WALL) continue;
      const color = getFloorColor(tile, c, r);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + c * TS, offsetY + r * TS, TS, TS);
    }
  }

  // 2. Z-sorted drawables
  const drawables: ZDrawable[] = [];

  for (const f of furniture) {
    const cached = getCachedSprite(f.sprite, zoom);
    const fx = offsetX + f.x * zoom;
    const fy = offsetY + f.y * zoom;
    drawables.push({
      zY: f.zY * zoom,
      draw: (c) => {
        if (f.mirrored) {
          c.save();
          c.translate(fx + cached.width, fy);
          c.scale(-1, 1);
          c.drawImage(cached, 0, 0);
          c.restore();
        } else {
          c.drawImage(cached, fx, fy);
        }
      },
    });
  }

  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.paletteIndex);
    const sprite = resolveCharacterSprite(sprites, ch);
    const px = offsetX + ch.col * TILE_SIZE * zoom - (CHAR_W * zoom) / 2;
    const py = offsetY + ch.row * TILE_SIZE * zoom - CHAR_H * zoom;

    drawables.push({
      zY: ch.row * TILE_SIZE * zoom,
      draw: (c) => {
        if (ch.selected) {
          const outline = getOutlineSprite(sprite);
          const oc = getCachedSprite(outline, zoom);
          c.drawImage(oc, px - zoom, py - zoom);
        }
        const cached = getCachedSprite(sprite, zoom);
        c.drawImage(cached, px, py);

        // Name label
        const labelY = py - 4 * zoom;
        c.font = `${Math.max(8, 7 * zoom)}px monospace`;
        c.textAlign = "center";
        const cx = px + cached.width / 2;
        c.fillStyle = "#0d0907";
        c.fillText(ch.name, cx + 1, labelY + 1);
        c.fillStyle = ch.selected ? "#A78BFA" : "#F5CBA7";
        c.fillText(ch.name, cx, labelY);

        // State badge
        if (ch.agentState !== "idle" && !ch.paused) {
          const badge = ch.agentState.toUpperCase();
          c.font = `${Math.max(6, 5 * zoom)}px monospace`;
          const bw = c.measureText(badge).width + 6 * zoom;
          const bx = cx - bw / 2;
          const by = labelY - 10 * zoom;
          const bh = 8 * zoom;
          c.fillStyle = "#1a1208";
          c.fillRect(bx, by, bw, bh);
          c.strokeStyle = "#7C3AED";
          c.lineWidth = zoom;
          c.strokeRect(bx, by, bw, bh);
          c.fillStyle = "#A78BFA";
          c.textAlign = "center";
          c.fillText(badge, cx, by + bh * 0.75);
        }
      },
    });
  }

  // 3. Z-sort and draw
  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw(ctx);
}

export function resolveCharacterSprite(
  sprites: CharacterSprites,
  ch: CharacterRenderState,
): SpriteData {
  if (ch.agentState === "done" && !ch.paused) return sprites.done;

  const isTyping =
    ch.charState === CharacterState.TYPING ||
    ch.agentState === "coding" ||
    ch.agentState === "thinking";

  if (isTyping) {
    return sprites.typing[ch.direction][ch.animFrame % 2];
  }

  return sprites.walk[ch.direction][ch.animFrame % 4];
}
