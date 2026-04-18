import type { CharacterRenderState, FurnitureInstance } from "../types";
import { CharacterState, Direction, TileType } from "../types";
import { getCachedSprite, getOutlineSprite } from "./spriteCache";
import { getFloorColor, TILE_SIZE } from "./tileMap";
import { getCharacterSprites, type CharacterSprites } from "../sprites/characters";
import type { SpriteData } from "../types";

const CHAR_W = 16;
const CHAR_H = 26;

const STATE_STYLES: Record<string, { text: string; border: string; fill: string }> = {
  idle: { text: "#E5E7EB", border: "#6B7280", fill: "#1F2937" },
  thinking: { text: "#FDE68A", border: "#F59E0B", fill: "#422006" },
  coding: { text: "#DBEAFE", border: "#3B82F6", fill: "#172554" },
  testing: { text: "#DCFCE7", border: "#22C55E", fill: "#052E16" },
  reviewing: { text: "#FDE68A", border: "#F59E0B", fill: "#422006" },
  debugging: { text: "#FECACA", border: "#EF4444", fill: "#450A0A" },
  done: { text: "#DCFCE7", border: "#22C55E", fill: "#052E16" },
};

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
  const time = performance.now() / 1000;

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
        c.save();
        c.globalAlpha = 0.18;
        c.fillStyle = "#05070C";
        c.fillRect(fx + 4 * zoom, fy + cached.height - 5 * zoom, cached.width - 8 * zoom, 4 * zoom);
        c.restore();

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
    const jitterX = ch.agentState === "coding" && !ch.paused ? Math.sin(time * 28 + ch.col) * 0.6 * zoom : 0;
    const bobY = ch.agentState === "thinking" && !ch.paused
      ? Math.sin(time * 3 + ch.row) * 1.4 * zoom
      : ch.agentState === "idle"
        ? Math.sin(time * 2 + ch.row) * 0.6 * zoom
        : 0;
    const px = offsetX + ch.col * TILE_SIZE * zoom - (CHAR_W * zoom) / 2 + jitterX;
    const py = offsetY + ch.row * TILE_SIZE * zoom - CHAR_H * zoom + bobY;
    const stateStyle = STATE_STYLES[ch.agentState] ?? STATE_STYLES.idle;

    drawables.push({
      zY: ch.row * TILE_SIZE * zoom,
      draw: (c) => {
        c.fillStyle = "rgba(8, 10, 18, 0.28)";
        c.beginPath();
        c.ellipse(
          px + (CHAR_W * zoom) / 2,
          py + CHAR_H * zoom + 4 * zoom,
          9 * zoom,
          3.4 * zoom,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();

        if (ch.selected) {
          const outline = getOutlineSprite(sprite);
          const oc = getCachedSprite(outline, zoom);
          c.drawImage(oc, px - zoom, py - zoom);
        }

        if (!ch.paused) {
          const deskGlow = getDeskGlow(ch.agentState);
          if (deskGlow) {
            c.save();
            c.globalAlpha = deskGlow.alpha;
            c.fillStyle = deskGlow.color;
            c.fillRect(px - 3 * zoom, py + CHAR_H * zoom - 2 * zoom, CHAR_W * zoom + 6 * zoom, 5 * zoom);
            c.restore();
          }
        }

        const cached = getCachedSprite(sprite, zoom);
        if (ch.agentState === "done" && !ch.paused) {
          c.save();
          c.shadowColor = "rgba(52, 211, 153, 0.55)";
          c.shadowBlur = 10 * zoom;
          c.drawImage(cached, px, py);
          c.restore();
        }
        c.drawImage(cached, px, py);

        if (!ch.paused && ch.agentState === "thinking") {
          drawThinkingParticles(c, px, py, zoom, time, ch.col, ch.row);
        }

        if (!ch.paused && ch.agentState === "coding") {
          drawCodingActivity(c, px, py, zoom, time, ch.col);
        }

        // Name label below the sprite for clearer separation from state.
        const labelFontSize = Math.max(11, 7.2 * zoom);
        const labelY = py + cached.height + 14 * zoom;
        c.font = `${labelFontSize}px Inter, system-ui, sans-serif`;
        c.textAlign = "center";
        const cx = px + cached.width / 2;
        const labelWidth = c.measureText(ch.name).width + 12 * zoom;
        const labelHeight = 10 * zoom;
        drawRoundedRect(
          c,
          cx - labelWidth / 2,
          labelY - labelHeight + 2 * zoom,
          labelWidth,
          labelHeight,
          4 * zoom,
          "rgba(15, 23, 42, 0.82)",
          ch.selected ? "#60A5FA" : "rgba(255,255,255,0.08)",
        );
        c.fillStyle = "#0b0f14";
        c.fillText(ch.name, cx + 1, labelY + 1);
        c.fillStyle = "#E5E7EB";
        c.fillText(ch.name, cx, labelY);

        // State badge
        {
          const badge = ch.paused ? "PAUSED" : ch.agentState.toUpperCase();
          const badgeStyle = ch.paused
            ? { text: "#FECACA", border: "#EF4444", fill: "#450A0A" }
            : stateStyle;
          const badgeFontSize = Math.max(7, 5.4 * zoom);
          c.font = `${badgeFontSize}px Inter, system-ui, sans-serif`;
          const bw = c.measureText(badge).width + 10 * zoom;
          const bx = cx - bw / 2;
          const pulse = ch.agentState === "thinking" && !ch.paused ? 1 + Math.sin(time * 4) * 0.05 : 1;
          const by = py - 11 * zoom;
          const bh = 9 * zoom;
          c.save();
          c.translate(cx, by + bh / 2);
          c.scale(pulse, pulse);
          c.translate(-cx, -(by + bh / 2));
          drawRoundedRect(
            c,
            bx,
            by,
            bw,
            bh,
            4 * zoom,
            badgeStyle.fill,
            badgeStyle.border,
            Math.max(1, zoom * 0.8),
          );
          c.restore();
          c.fillStyle = badgeStyle.text;
          c.textAlign = "center";
          c.fillText(badge, cx, by + bh * 0.74);
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 1,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function getDeskGlow(agentState: string): { color: string; alpha: number } | null {
  switch (agentState) {
    case "thinking":
      return { color: "#F59E0B", alpha: 0.14 };
    case "coding":
      return { color: "#3B82F6", alpha: 0.16 };
    case "done":
      return { color: "#22C55E", alpha: 0.16 };
    default:
      return null;
  }
}

function drawThinkingParticles(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  zoom: number,
  time: number,
  col: number,
  row: number,
): void {
  const baseX = px + 8 * zoom;
  const baseY = py - 2 * zoom;
  for (let i = 0; i < 3; i++) {
    const phase = time * 1.8 + i * 0.9 + col * 0.12 + row * 0.08;
    const x = baseX + Math.sin(phase) * 5 * zoom;
    const y = baseY - (i * 4 + ((phase * 10) % 4)) * zoom;
    ctx.save();
    ctx.globalAlpha = 0.28 - i * 0.06;
    ctx.fillStyle = "#FDE68A";
    ctx.beginPath();
    ctx.arc(x, y, 1.3 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCodingActivity(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  zoom: number,
  time: number,
  col: number,
): void {
  const blink = Math.sin(time * 8 + col) > 0.15;
  if (!blink) return;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#93C5FD";
  ctx.fillRect(px + 2 * zoom, py + 11 * zoom, 2 * zoom, 1 * zoom);
  ctx.fillRect(px + 5 * zoom, py + 12 * zoom, 4 * zoom, 1 * zoom);
  ctx.fillRect(px + 10 * zoom, py + 11 * zoom, 3 * zoom, 1 * zoom);
  ctx.restore();
}
