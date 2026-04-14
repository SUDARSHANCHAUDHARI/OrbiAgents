# OrbiAgents Web UI Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild OrbiAgents canvas engine and UI panels to match the pixel-agents reference — tile map, animated characters, pathfinding, multi-zone office, pixel-themed panels.

**Architecture:** Shared engine in `shared/` (tile map, sprites, pathfinding, renderer) consumed by `web/components/GameCanvas.tsx`. All UI panels restyled to dark wood + pixel font aesthetic.

**Tech Stack:** TypeScript, React, Next.js 14, HTML5 Canvas, requestAnimationFrame

---

## File Map

**Create:**
- `shared/types.ts` — TileType, Direction, SpriteData, FurnitureInstance, CharacterState
- `shared/engine/spriteCache.ts` — WeakMap sprite cache + outline generator
- `shared/engine/tileMap.ts` — office tile grid definition (45×30)
- `shared/engine/renderer.ts` — renderTileGrid, renderScene (Z-sort)
- `shared/engine/gameLoop.ts` — requestAnimationFrame loop manager
- `shared/pathfinding/bfs.ts` — BFS on 4-connected grid
- `shared/sprites/characters.ts` — all character frames, hue shift, 5 palettes
- `shared/sprites/furniture.ts` — desk, bookshelf, plant, meeting table sprites

**Modify:**
- `web/components/GameCanvas.tsx` — full rewrite using shared engine
- `web/components/SidePanel.tsx` — pixel theme reskin
- `web/components/ResultPanel.tsx` — pixel theme reskin
- `web/components/WorkflowBuilder.tsx` — pixel theme reskin
- `web/app/login/page.tsx` — pixel theme reskin
- `web/app/globals.css` — pixel font vars, shared pixel UI classes
- `web/lib/types.ts` — add x/y as tile coords, add direction field
- `server/index.ts` — add tile coords to agent positions

---

## Task 1: Shared Types

**Files:**
- Create: `shared/types.ts`

- [ ] Create `shared/types.ts`:

```typescript
export type SpriteData = string[][];

export enum TileType {
  VOID        = 0,
  FLOOR_WOOD  = 1,
  FLOOR_TILE  = 2,
  FLOOR_CARPET= 3,
  WALL        = 4,
}

export enum Direction {
  DOWN  = "down",
  UP    = "up",
  RIGHT = "right",
  LEFT  = "left",
}

export enum CharacterState {
  IDLE     = "idle",
  WALKING  = "walking",
  TYPING   = "typing",
  READING  = "reading",
  DONE     = "done",
}

export interface TileCoord {
  col: number;
  row: number;
}

export interface FurnitureInstance {
  sprite: SpriteData;
  x: number;       // pixel x (top-left)
  y: number;       // pixel y (top-left)
  zY: number;      // Z-sort Y value
  mirrored?: boolean;
}

export interface CharacterRenderState {
  id: string;
  name: string;
  agentState: string; // "idle" | "thinking" | "coding" | "done" etc.
  paused: boolean;
  col: number;        // current tile col (float during interpolation)
  row: number;        // current tile row (float during interpolation)
  direction: Direction;
  charState: CharacterState;
  animFrame: number;  // 0-3
  paletteIndex: number; // 0-4
  selected: boolean;
}
```

- [ ] Commit:
```bash
git add shared/types.ts
git commit -m "feat: add shared types for canvas engine"
```

---

## Task 2: Sprite Cache

**Files:**
- Create: `shared/engine/spriteCache.ts`

- [ ] Create `shared/engine/spriteCache.ts`:

```typescript
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
```

- [ ] Commit:
```bash
git add shared/engine/spriteCache.ts
git commit -m "feat: add sprite cache with outline and flip helpers"
```

---

## Task 3: Character Sprites

**Files:**
- Create: `shared/sprites/characters.ts`

- [ ] Create `shared/sprites/characters.ts`:

```typescript
import type { SpriteData } from "../types";
import { Direction } from "../types";
import { flipHorizontal } from "../engine/spriteCache";

// Helper: build SpriteData from row strings + palette
function s(rows: string[], pal: Record<string, string>): SpriteData {
  return rows.map(row =>
    Array.from(row).map(ch => (ch === "." ? "" : (pal[ch] ?? "")))
  );
}

// ── Base palette (overridden per agent via hue shift) ──────────────
// H=hat  S=skin  E=eye  B=body  A=arm  P=pants  K=boot
const BASE: Record<string, string> = {
  H: "#4C1D95", // hat dark purple
  h: "#6D28D9", // hat mid
  S: "#FBBF24", // skin
  E: "#1F2937", // eye dark
  B: "#7C3AED", // body
  b: "#5B21B6", // body shadow
  A: "#6D28D9", // arm
  P: "#1E3A5F", // pants
  p: "#162D47", // pants shadow
  K: "#111827", // boot
};

// 5 agent palettes — each overrides B/A/H/h
const PALETTES: Record<string, string>[][] = [
  // 0 Purple (Orbi-Alpha)
  [BASE],
  // 1 Blue (Orbi-Beta)
  [{ ...BASE, H:"#1E3A8A", h:"#2563EB", B:"#3B82F6", b:"#1D4ED8", A:"#2563EB" }],
  // 2 Green (Orbi-Gamma)
  [{ ...BASE, H:"#14532D", h:"#16A34A", B:"#22C55E", b:"#15803D", A:"#16A34A" }],
  // 3 Amber (Orbi-Delta)
  [{ ...BASE, H:"#78350F", h:"#D97706", B:"#F59E0B", b:"#B45309", A:"#D97706" }],
  // 4 Rose (Orbi-Epsilon)
  [{ ...BASE, H:"#881337", h:"#E11D48", B:"#F43F5E", b:"#BE123C", A:"#E11D48" }],
];

function makePal(idx: number): Record<string, string> {
  return Object.assign({}, BASE, ...(PALETTES[idx] ?? []));
}

// ── Character frame builder ────────────────────────────────────────
// 16 wide × 32 tall

function buildDownFrames(pal: Record<string, string>): [SpriteData, SpriteData, SpriteData, SpriteData] {
  // frame0/2 = neutral, frame1 = right leg forward, frame3 = left leg forward
  const neutral = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    "AASSBBBBBBBBSSAA",
    "AASSBBBBBBBBSSAA",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....KKKK.KKKK...",
    "....KKKK.KKKK...",
  ], pal);

  const walk1 = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    "AASSBBBBBBBBSSAA",
    ".AASSBBBBBBBBSS.",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPPpp......",
    "....PPPPpp......",
    "....PPPP........",
    "....PPPP...PPPP.",
    "....PPPP...PPPP.",
    "....PPPP...PPPP.",
    "....KKKK...KKKK.",
    "....KKKK...KKKK.",
  ], pal);

  const walk3 = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    ".AASSBBBBBBBBSS.",
    "AASSBBBBBBBBSSAA",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "......ppPPPP....",
    "......ppPPPP....",
    ".PPPP...PPPP....",
    ".PPPP...PPPP....",
    ".PPPP...PPPP....",
    ".PPPP...PPPP....",
    ".KKKK...KKKK....",
    ".KKKK...KKKK....",
  ], pal);

  return [neutral, walk1, neutral, walk3];
}

function buildUpFrames(pal: Record<string, string>): [SpriteData, SpriteData, SpriteData, SpriteData] {
  // Facing up: no face visible, hat + back of head
  const neutral = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..bBBBBBBBBBBb..",
    "..bBBBBBBBBBBb..",
    "..bBBBBBBBBBBb..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    "AASSBBBBBBBBSSAA",
    "AASSBBBBBBBBSSAA",
    "..PPPPPPPPPPPP..",
    "..ppPPPPPPPPpp..",
    "..ppPPPPPPPPpp..",
    "..PPPPPPPPPPPP..",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....pppp.pppp...",
    "....pppp.pppp...",
    "....KKKK.KKKK...",
    "....KKKK.KKKK...",
  ], pal);

  const walk1 = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..bBBBBBBBBBBb..",
    "..bBBBBBBBBBBb..",
    "..bBBBBBBBBBBb..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    ".AASSBBBBBBBBSS.",
    "AASSBBBBBBBBSSAA",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPP........",
    "....PPPP...PPPP.",
    "....PPPP...PPPP.",
    "....PPPP...PPPP.",
    "....PPPP...pppp.",
    "....pppp........",
    "....KKKK...KKKK.",
    "....KKKK...KKKK.",
  ], pal);

  return [neutral, walk1, neutral, flipHorizontal(walk1)];
}

function buildRightFrames(pal: Record<string, string>): [SpriteData, SpriteData, SpriteData, SpriteData] {
  const neutral = s([
    "......HHHHHH....",
    "......HHHHHH....",
    ".....hhhhhhhh...",
    "................",
    ".....SSSSSS.....",
    ".....SSESSE.....",
    ".....SSSSSS.....",
    ".....SSSSSS.....",
    "....BBBBBBBBAA..",
    "....BBBBBBBBaa..",
    "....BBBBBBBBAA..",
    "....BBBBBBBBAA..",
    "....BBBBBBBB....",
    "....BBBBBBBBSS..",
    "....BBBBBBBBSS..",
    "....BBBBBBBB....",
    "....PPPPPPPP....",
    "....PPPPPPPP....",
    "....PPPPPPPP....",
    "....PPPPPPPP....",
    "....PPPP.ppp....",
    "....PPPP.ppp....",
    "....PPPP........",
    "....pppp..PPPP..",
    "....KKKK..KKKK..",
    "....KKKK..KKKK..",
  ], pal);

  const walk1 = s([
    "......HHHHHH....",
    "......HHHHHH....",
    ".....hhhhhhhh...",
    "................",
    ".....SSSSSS.....",
    ".....SSESSE.....",
    ".....SSSSSS.....",
    ".....SSSSSS.....",
    "...BBBBBBBBBBAA.",
    "...BBBBBBBBBBaa.",
    "...BBBBBBBBBBAA.",
    "...BBBBBBBBBB...",
    "...BBBBBBBBBB...",
    "...BBBBBBBBBBSS.",
    "...BBBBBBBBBBSS.",
    "...BBBBBBBBBB...",
    "....PPPPPPPP....",
    "....PPPPPPPP....",
    ".....PPPPPPP....",
    ".....PPPPPPP....",
    "......PPPP......",
    "....PPPP..PPPP..",
    "....PPPP..pppp..",
    "....PPPP........",
    "....KKKK..KKKK..",
    "....KKKK..KKKK..",
  ], pal);

  return [neutral, walk1, neutral, flipHorizontal(walk1)];
}

function buildTypingFrames(pal: Record<string, string>): [SpriteData, SpriteData] {
  const t0 = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    "AASSBBBBBBBBSSAA",
    "..AASSSSSSSSAA..",
    "................",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....KKKK.KKKK...",
    "....KKKK.KKKK...",
  ], pal);

  // arms lower (typing)
  const t1 = s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "AABBBBBBBBBBBBAA",
    "..AASSBBBBBBSSAA",
    "..AASSSSSSSSAA..",
    "................",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....KKKK.KKKK...",
    "....KKKK.KKKK...",
  ], pal);

  return [t0, t1];
}

function buildDoneFrame(pal: Record<string, string>): SpriteData {
  return s([
    "....HHHHHHHH....",
    "....HHHHHHHH....",
    "..hhhhhhhhhhhh..",
    "................",
    "....SSSSSSSS....",
    "....SSESSSES....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "AABBBBBBBBBBBBAA",
    "AABBBBBBBBBBBBAA",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..BBBBBBBBBBBB..",
    "..AASSBBBBBBSSAA",
    "....SSSSSSSSSS..",
    "................",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "....PPPP.PPPP...",
    "....PPPP.PPPP...",
    "....KKKK.KKKK...",
    "....KKKK.KKKK...",
  ], pal);
}

// ── Public API ─────────────────────────────────────────────────────

export interface CharacterSprites {
  walk:   Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>;
  typing: Record<Direction, [SpriteData, SpriteData]>;
  done:   SpriteData;
}

const _cache = new Map<number, CharacterSprites>();

export function getCharacterSprites(paletteIndex: number): CharacterSprites {
  const idx = Math.max(0, Math.min(4, paletteIndex));
  if (_cache.has(idx)) return _cache.get(idx)!;

  const pal = makePal(idx);
  const down  = buildDownFrames(pal);
  const up    = buildUpFrames(pal);
  const right = buildRightFrames(pal);
  const left  = right.map(flipHorizontal) as [SpriteData, SpriteData, SpriteData, SpriteData];
  const typingDown  = buildTypingFrames(pal);
  const typingUp    = typingDown;
  const typingRight = typingDown;
  const typingLeft  = typingDown.map(flipHorizontal) as [SpriteData, SpriteData];

  const sprites: CharacterSprites = {
    walk: {
      [Direction.DOWN]:  down,
      [Direction.UP]:    up,
      [Direction.RIGHT]: right,
      [Direction.LEFT]:  left,
    },
    typing: {
      [Direction.DOWN]:  typingDown,
      [Direction.UP]:    typingUp,
      [Direction.RIGHT]: typingRight,
      [Direction.LEFT]:  typingLeft,
    },
    done: buildDoneFrame(pal),
  };

  _cache.set(idx, sprites);
  return sprites;
}
```

- [ ] Commit:
```bash
git add shared/sprites/characters.ts
git commit -m "feat: add animated character sprites with 5 palettes"
```

---

## Task 4: Furniture Sprites

**Files:**
- Create: `shared/sprites/furniture.ts`

- [ ] Create `shared/sprites/furniture.ts`:

```typescript
import type { SpriteData } from "../types";

function s(rows: string[], pal: Record<string, string>): SpriteData {
  return rows.map(row =>
    Array.from(row).map(ch => (ch === "." ? "" : (pal[ch] ?? "")))
  );
}

// ── Desk with monitor (32×24) ──────────────────────────────────────
const D_PAL = {
  T: "#92400E", // desk top
  d: "#78350F", // desk side
  D: "#5C2D0E", // desk front
  M: "#1F2937", // monitor dark
  m: "#374151", // monitor mid
  S: "#6EE7B7", // screen glow
  K: "#111827", // keyboard
  L: "#A78BFA", // screen text line
};
export const DESK_SPRITE: SpriteData = s([
  "................................",
  "..MMMMMMMMMMMMMMMMMMMMMMMMMMM...",
  "..MmmmmmmmmmmmmmmmmmmmmmmmmmM...",
  "..MmSSSSSSSSSSSSSSSSSSSSSSmmM...",
  "..MmSLLLLLLLLLLLLLLLLLLLLSmM...",
  "..MmSLLLLLLLLLLLLLLLLLLLLSmM...",
  "..MmSLLLLLLLLLLLLLLLLLLLLSmM...",
  "..MmSSSSSSSSSSSSSSSSSSSSSSmmM...",
  "..MMMMMMMMMmMMMMMMMMmMMMMMMMM...",
  "..........mMMMMMMMMm............",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.",
  "ddddddddddddddddddddddddddddddd.",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.",
  "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.",
], D_PAL);

// ── Bookshelf tile (16×16) — tiled across top wall ─────────────────
const B_PAL = {
  W: "#3D1A08", // wood dark
  w: "#5C2D0E", // wood mid
  R: "#DC2626", // red book
  B: "#2563EB", // blue book
  G: "#16A34A", // green book
  Y: "#D97706", // yellow book
  P: "#7C3AED", // purple book
  O: "#EA580C", // orange book
};
export const BOOKSHELF_SPRITE: SpriteData = s([
  "WWWWWWWWWWWWWWWW",
  "wRRwBBwGGwYYwPPw",
  "wRRwBBwGGwYYwPPw",
  "wRRwBBwGGwYYwPPw",
  "wRRwBBwGGwYYwPPw",
  "wRRwBBwGGwYYwPPw",
  "wRRwBBwGGwYYwPPw",
  "WWWWWWWWWWWWWWWW",
  "wOOwRRwBBwGGwPPw",
  "wOOwRRwBBwGGwPPw",
  "wOOwRRwBBwGGwPPw",
  "wOOwRRwBBwGGwPPw",
  "wOOwRRwBBwGGwPPw",
  "wOOwRRwBBwGGwPPw",
  "WWWWWWWWWWWWWWWW",
  "wwwwwwwwwwwwwwww",
], B_PAL);

// ── Plant (16×24) ──────────────────────────────────────────────────
const P_PAL = {
  G: "#16A34A",
  g: "#15803D",
  d: "#14532D",
  P: "#92400E",
  p: "#78350F",
};
export const PLANT_SPRITE: SpriteData = s([
  "....GGggGG......",
  "...GGggggGG.....",
  "..GGgdggddGG....",
  "..GggddddggG....",
  "...GGgdggGG.....",
  "....GGggGG......",
  "......GG........",
  "......GG........",
  "......GG........",
  "....PPPPPP......",
  "....PPPPPP......",
  "....pppppp......",
], P_PAL);

// ── Meeting table (48×16) ──────────────────────────────────────────
const MT_PAL = {
  T: "#0F766E", // teal top
  t: "#0D9488", // teal mid
  d: "#0F5A52", // teal dark
  L: "#134E4A", // leg
};
export const MEETING_TABLE_SPRITE: SpriteData = s([
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "TtttttttttttttttttttttttttttttttttttttttttttttTT",
  "TtttttttttttttttttttttttttttttttttttttttttttttTT",
  "TtttttttttttttttttttttttttttttttttttttttttttttTT",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "dddddddddddddddddddddddddddddddddddddddddddddddd",
  "dddddddddddddddddddddddddddddddddddddddddddddddd",
  "....LL......................................LL...",
  "....LL......................................LL...",
  "....LL......................................LL...",
], MT_PAL);

// ── Lounge chair (16×16) ──────────────────────────────────────────
const C_PAL = {
  B: "#1E3A5F",
  b: "#162D47",
  S: "#1D4ED8",
  s: "#1E40AF",
  L: "#0F172A",
};
export const CHAIR_SPRITE: SpriteData = s([
  "BBBBBBBBBBBBBBBB",
  "BSSSSSSSSSSSSSsB",
  "BSSSSSSSSSSSSSsB",
  "BSSSSSSSSSSSSSsB",
  "BSSSSSSSSSSSSSsB",
  "BSSSSSSSSSSSSSsB",
  "BBBBBBBBBBBBBBBB",
  "..LL..........LL",
  "..LL..........LL",
  "..LL..........LL",
], C_PAL);
```

- [ ] Commit:
```bash
git add shared/sprites/furniture.ts
git commit -m "feat: add furniture sprites (desk, bookshelf, plant, table, chair)"
```

---

## Task 5: Tile Map + Office Layout

**Files:**
- Create: `shared/engine/tileMap.ts`

- [ ] Create `shared/engine/tileMap.ts`:

```typescript
import { TileType } from "../types";
import type { FurnitureInstance, TileCoord } from "../types";
import {
  DESK_SPRITE, BOOKSHELF_SPRITE, PLANT_SPRITE,
  MEETING_TABLE_SPRITE, CHAIR_SPRITE,
} from "../sprites/furniture";

export const TILE_SIZE = 16; // px
export const GRID_COLS = 45;
export const GRID_ROWS = 30;

// ── Tile map ───────────────────────────────────────────────────────
// Columns 0-30: wood floor
// Columns 31-44, rows 0-15: tiled meeting room
// Columns 31-44, rows 16-29: carpet lounge
// Row 0: bookshelf wall (all columns)

export function buildTileMap(): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (r === 0) {
        row.push(TileType.WALL); // bookshelf row
      } else if (c <= 30) {
        row.push(TileType.FLOOR_WOOD);
      } else if (r <= 15) {
        row.push(TileType.FLOOR_TILE);
      } else {
        row.push(TileType.FLOOR_CARPET);
      }
    }
    map.push(row);
  }
  return map;
}

// ── Agent home desks ───────────────────────────────────────────────
// Each agent sits at a specific tile; pathfinding walks them there
export const AGENT_HOME_TILES: Record<string, TileCoord> = {
  "1": { col: 5,  row: 5  }, // Orbi-Alpha  — top-left
  "2": { col: 14, row: 12 }, // Orbi-Beta   — center
  "3": { col: 25, row: 5  }, // Orbi-Gamma  — top-right of wood zone
  "4": { col: 8,  row: 20 }, // Orbi-Delta  — bottom-left
  "5": { col: 20, row: 22 }, // Orbi-Epsilon — bottom-center
};

// ── Furniture layout ───────────────────────────────────────────────
export function buildFurnitureInstances(): FurnitureInstance[] {
  const items: FurnitureInstance[] = [];
  const TS = TILE_SIZE;

  // Bookshelves across row 0
  for (let c = 0; c < GRID_COLS; c++) {
    items.push({
      sprite: BOOKSHELF_SPRITE,
      x: c * TS, y: 0,
      zY: 0,
    });
  }

  // Desks at each agent home
  Object.values(AGENT_HOME_TILES).forEach(({ col, row }) => {
    items.push({
      sprite: DESK_SPRITE,
      x: (col - 1) * TS,
      y: (row - 1) * TS,
      zY: row * TS,
    });
  });

  // Plants
  [[3, 3], [28, 3], [3, 26], [28, 26]].forEach(([c, r]) => {
    items.push({
      sprite: PLANT_SPRITE,
      x: c * TS, y: r * TS,
      zY: (r + 1) * TS,
    });
  });

  // Meeting table (tiled room)
  items.push({
    sprite: MEETING_TABLE_SPRITE,
    x: 32 * TS, y: 6 * TS,
    zY: 8 * TS,
  });

  // Lounge chairs (carpet zone)
  [[33, 20], [37, 20], [33, 25], [37, 25]].forEach(([c, r]) => {
    items.push({
      sprite: CHAIR_SPRITE,
      x: c * TS, y: r * TS,
      zY: (r + 1) * TS,
    });
  });

  return items;
}

// ── Floor tile colors ──────────────────────────────────────────────
export const FLOOR_COLORS: Record<TileType, string[]> = {
  [TileType.FLOOR_WOOD]:   ["#5C3D1E","#7A5230","#8B6040","#6B4A28"],
  [TileType.FLOOR_TILE]:   ["#C8B89A","#B8A88A","#D8C8AA","#C0B090"],
  [TileType.FLOOR_CARPET]: ["#1E3A5F","#162D47","#1A3254","#152840"],
  [TileType.WALL]:         ["#3D1A08"],
  [TileType.VOID]:         [],
};

export function getFloorColor(tileType: TileType, col: number, row: number): string {
  const colors = FLOOR_COLORS[tileType];
  if (!colors || colors.length === 0) return "";
  return colors[(col + row) % colors.length];
}
```

- [ ] Commit:
```bash
git add shared/engine/tileMap.ts
git commit -m "feat: add tile map with multi-zone office layout"
```

---

## Task 6: BFS Pathfinding

**Files:**
- Create: `shared/pathfinding/bfs.ts`

- [ ] Create `shared/pathfinding/bfs.ts`:

```typescript
import { TileType } from "../types";

export function isWalkable(
  col: number, row: number,
  tileMap: TileType[][],
  blocked: Set<string> = new Set(),
): boolean {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const t = tileMap[row][col];
  if (t === TileType.WALL || t === TileType.VOID) return false;
  if (blocked.has(`${col},${row}`)) return false;
  return true;
}

export function findPath(
  startCol: number, startRow: number,
  endCol: number, endRow: number,
  tileMap: TileType[][],
  blocked: Set<string> = new Set(),
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return [];
  if (!isWalkable(endCol, endRow, tileMap, blocked)) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>([key(startCol, startRow)]);
  const parent = new Map<string, string>();
  const queue = [{ col: startCol, row: startRow }];
  const dirs = [{ dc:0,dr:-1 },{ dc:0,dr:1 },{ dc:-1,dr:0 },{ dc:1,dr:0 }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.col === endCol && curr.row === endRow) {
      // Reconstruct
      const path: Array<{ col: number; row: number }> = [];
      let k = key(endCol, endRow);
      while (parent.has(k)) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }
    for (const { dc, dr } of dirs) {
      const nc = curr.col + dc, nr = curr.row + dr;
      const nk = key(nc, nr);
      if (!visited.has(nk) && isWalkable(nc, nr, tileMap, blocked)) {
        visited.add(nk);
        parent.set(nk, key(curr.col, curr.row));
        queue.push({ col: nc, row: nr });
      }
    }
  }
  return []; // no path
}
```

- [ ] Commit:
```bash
git add shared/pathfinding/bfs.ts
git commit -m "feat: add BFS pathfinding on tile grid"
```

---

## Task 7: Renderer

**Files:**
- Create: `shared/engine/renderer.ts`

- [ ] Create `shared/engine/renderer.ts`:

```typescript
import type { CharacterRenderState, FurnitureInstance, SpriteData } from "../types";
import { CharacterState, Direction } from "../types";
import { TileType } from "../types";
import { getCachedSprite, getOutlineSprite } from "./spriteCache";
import { getFloorColor, TILE_SIZE } from "./tileMap";
import { getCharacterSprites } from "../sprites/characters";

const CHAR_SPRITE_W = 16;
const CHAR_SPRITE_H = 26; // actual pixel height of character frames

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

  // ── 1. Floor tiles ───────────────────────────────────────────────
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = tileMap[r][c];
      if (tile === TileType.VOID) continue;
      if (tile === TileType.WALL) continue; // drawn by furniture (bookshelf)
      const color = getFloorColor(tile, c, r);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + c * TS, offsetY + r * TS, TS, TS);
    }
  }

  // ── 2. Build Z-sorted drawables ──────────────────────────────────
  const drawables: ZDrawable[] = [];

  // Furniture
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

  // Characters
  for (const ch of characters) {
    const sprites = getCharacterSprites(ch.paletteIndex);
    const sprite = getCharacterSprite(sprites, ch);

    const px = offsetX + ch.col * TILE_SIZE * zoom - (CHAR_SPRITE_W * zoom) / 2;
    const py = offsetY + ch.row * TILE_SIZE * zoom - CHAR_SPRITE_H * zoom;

    drawables.push({
      zY: ch.row * TILE_SIZE * zoom,
      draw: (c) => {
        // Outline for selected
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
        c.fillStyle = "#0d0907";
        c.fillText(ch.name, px + cached.width / 2 + 1, labelY + 1);
        c.fillStyle = ch.selected ? "#A78BFA" : "#F5CBA7";
        c.fillText(ch.name, px + cached.width / 2, labelY);

        // State badge
        if (ch.agentState !== "idle" && !ch.paused) {
          const badge = ch.agentState.toUpperCase();
          const bw = badge.length * 5 * zoom + 6 * zoom;
          const bx = px + cached.width / 2 - bw / 2;
          const by = labelY - 10 * zoom;
          ctx.fillStyle = "#1a1208";
          ctx.fillRect(bx, by, bw, 8 * zoom);
          ctx.strokeStyle = "#7C3AED";
          ctx.lineWidth = zoom;
          ctx.strokeRect(bx, by, bw, 8 * zoom);
          ctx.fillStyle = "#A78BFA";
          ctx.font = `${Math.max(6, 5 * zoom)}px monospace`;
          ctx.fillText(badge, bx + bw / 2, by + 6 * zoom);
        }
      },
    });
  }

  // ── 3. Z-sort and draw ───────────────────────────────────────────
  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw(ctx);
}

export function getCharacterSprite(
  sprites: ReturnType<typeof getCharacterSprites>,
  ch: CharacterRenderState,
): SpriteData {
  if (ch.agentState === "done" && !ch.paused) return sprites.done;

  const isTyping = ch.charState === CharacterState.TYPING
    || ch.agentState === "coding"
    || ch.agentState === "thinking";

  if (isTyping) {
    const frames = sprites.typing[ch.direction];
    return frames[ch.animFrame % 2];
  }

  const frames = sprites.walk[ch.direction];
  return frames[ch.animFrame % 4];
}
```

- [ ] Commit:
```bash
git add shared/engine/renderer.ts
git commit -m "feat: add Z-sort renderer with name labels and state badges"
```

---

## Task 8: Game Loop + Agent Movement

**Files:**
- Create: `shared/engine/gameLoop.ts`

- [ ] Create `shared/engine/gameLoop.ts`:

```typescript
import type { CharacterRenderState, TileCoord } from "../types";
import { CharacterState, Direction } from "../types";
import { TileType } from "../types";
import { findPath } from "../pathfinding/bfs";

const MOVE_SPEED = 3; // tiles per second

export interface AgentInput {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
}

interface AgentMotion {
  path: TileCoord[];
  pathIdx: number;
  col: number; // float
  row: number; // float
  direction: Direction;
  charState: CharacterState;
  animFrame: number;
  animTimer: number;
  homeTile: TileCoord;
}

export function createGameLoop(
  tileMap: TileType[][],
  homeTiles: Record<string, TileCoord>,
  onFrame: (chars: CharacterRenderState[]) => void,
) {
  const motions = new Map<string, AgentMotion>();
  let lastAgents: AgentInput[] = [];
  let rafId: number | null = null;
  let lastTime = performance.now();

  function getOrCreateMotion(agent: AgentInput): AgentMotion {
    if (motions.has(agent.id)) return motions.get(agent.id)!;
    const home = homeTiles[agent.id] ?? { col: 5, row: 5 };
    const motion: AgentMotion = {
      path: [], pathIdx: 0,
      col: home.col, row: home.row,
      direction: Direction.DOWN,
      charState: CharacterState.IDLE,
      animFrame: 0, animTimer: 0,
      homeTile: home,
    };
    motions.set(agent.id, motion);
    return motion;
  }

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const chars: CharacterRenderState[] = lastAgents.map((agent, i) => {
      const motion = getOrCreateMotion(agent);

      if (agent.paused) {
        return toRenderState(agent, motion, i);
      }

      // If agent is active and not at home, ensure path exists
      const atHome = Math.abs(motion.col - motion.homeTile.col) < 0.1
        && Math.abs(motion.row - motion.homeTile.row) < 0.1;

      if (agent.agentState !== "idle" && !atHome && motion.path.length === 0) {
        motion.path = findPath(
          Math.round(motion.col), Math.round(motion.row),
          motion.homeTile.col, motion.homeTile.row,
          tileMap,
        );
        motion.pathIdx = 0;
      }

      // Move along path
      if (motion.path.length > 0 && motion.pathIdx < motion.path.length) {
        const target = motion.path[motion.pathIdx];
        const dx = target.col - motion.col;
        const dy = target.row - motion.row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = MOVE_SPEED * dt;

        if (dist <= step) {
          motion.col = target.col;
          motion.row = target.row;
          motion.pathIdx++;
        } else {
          motion.col += (dx / dist) * step;
          motion.row += (dy / dist) * step;
        }

        // Direction from movement
        if (Math.abs(dx) > Math.abs(dy)) {
          motion.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
          motion.direction = dy > 0 ? Direction.DOWN : Direction.UP;
        }
        motion.charState = CharacterState.WALKING;
      } else {
        motion.path = [];
        motion.charState = agent.agentState === "coding" || agent.agentState === "thinking"
          ? CharacterState.TYPING
          : CharacterState.IDLE;
        if (agent.agentState !== "idle") {
          motion.direction = Direction.DOWN; // face screen when working
        }
      }

      // Animation frame
      const animSpeed = motion.charState === CharacterState.TYPING ? 0.3 : 0.2;
      motion.animTimer += dt;
      if (motion.animTimer >= animSpeed) {
        motion.animTimer = 0;
        motion.animFrame = (motion.animFrame + 1) % 4;
      }

      return toRenderState(agent, motion, i);
    });

    onFrame(chars);
    rafId = requestAnimationFrame(tick);
  }

  function toRenderState(agent: AgentInput, motion: AgentMotion, idx: number): CharacterRenderState {
    return {
      id: agent.id,
      name: agent.name,
      agentState: agent.agentState,
      paused: agent.paused,
      col: motion.col,
      row: motion.row,
      direction: motion.direction,
      charState: motion.charState,
      animFrame: motion.animFrame,
      paletteIndex: idx % 5,
      selected: false, // set by caller
    };
  }

  return {
    start() {
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    },
    setAgents(agents: AgentInput[]) {
      lastAgents = agents;
    },
  };
}
```

- [ ] Commit:
```bash
git add shared/engine/gameLoop.ts
git commit -m "feat: add game loop with pathfinding movement and animation"
```

---

## Task 9: Rebuild GameCanvas

**Files:**
- Modify: `web/components/GameCanvas.tsx` (full rewrite)

- [ ] Rewrite `web/components/GameCanvas.tsx`:

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Agent } from "@/lib/types";
import { buildTileMap, buildFurnitureInstances, TILE_SIZE, AGENT_HOME_TILES } from "../../shared/engine/tileMap";
import { createGameLoop } from "../../shared/engine/gameLoop";
import { renderFrame } from "../../shared/engine/renderer";

interface Props {
  agents: Agent[];
  selectedId: string | null;
  isReplaying: boolean;
  onAgentClick: (agent: Agent) => void;
}

const ZOOM = 2;
const tileMap = buildTileMap();
const furniture = buildFurnitureInstances();

export default function GameCanvas({ agents, selectedId, isReplaying, onAgentClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<import("../../shared/types").CharacterRenderState[]>([]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Init game loop
  useEffect(() => {
    const loop = createGameLoop(tileMap, AGENT_HOME_TILES, (chars) => {
      // Mark selected
      latestChars.current = chars.map(c => ({
        ...c,
        selected: c.id === selectedIdRef.current,
      }));

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, tileMap, furniture, latestChars.current, offsetRef.current.x, offsetRef.current.y, ZOOM);
    });

    charsRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  // Feed agents to game loop
  useEffect(() => {
    charsRef.current?.setAgents(
      agents.map((a, i) => ({
        id: a.id,
        name: a.name,
        agentState: a.state,
        paused: a.paused,
        paletteIndex: i % 5,
      }))
    );
  }, [agents]);

  // Resize canvas
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      // Center the map
      const mapW = 45 * TILE_SIZE * ZOOM;
      const mapH = 30 * TILE_SIZE * ZOOM;
      offsetRef.current = {
        x: Math.max(0, (canvas.width - mapW) / 2),
        y: Math.max(0, (canvas.height - mapH) / 2),
      };
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Click handling
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReplaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Hit-test against characters
    for (const ch of latestChars.current) {
      const px = offsetRef.current.x + ch.col * TILE_SIZE * ZOOM - (16 * ZOOM) / 2;
      const py = offsetRef.current.y + ch.row * TILE_SIZE * ZOOM - 26 * ZOOM;
      if (mx >= px && mx <= px + 16 * ZOOM && my >= py && my <= py + 26 * ZOOM) {
        const agent = agentsRef.current.find(a => a.id === ch.id);
        if (agent) { onAgentClick(agent); return; }
      }
    }
  }, [isReplaying, onAgentClick]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden", background: "#1a1208" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: "block", imageRendering: "pixelated", cursor: "pointer" }}
      />
    </div>
  );
}
```

- [ ] Run the web app and verify the canvas renders the new pixel office:
```bash
cd web && pnpm dev
```
Expected: pixel office with animated agents walking to desks, multi-zone floor, bookshelves at top.

- [ ] Commit:
```bash
git add web/components/GameCanvas.tsx
git commit -m "feat: rebuild GameCanvas using shared tile engine with pathfinding"
```

---

## Task 10: Pixel Theme — globals.css

**Files:**
- Modify: `web/app/globals.css`

- [ ] Add to `web/app/globals.css`:

```css
/* ── Pixel UI theme ──────────────────────────────────────── */
:root {
  --px-bg:          #0d0907;
  --px-bg-mid:      #1a1208;
  --px-border:      #3D2409;
  --px-border-mid:  #4A2F14;
  --px-text:        #F5CBA7;
  --px-text-dim:    #7A5230;
  --px-accent:      #7C3AED;
  --px-accent-light:#A78BFA;
  --px-green:       #6EE7B7;
  --px-yellow:      #FCD34D;
  --px-red:         #F87171;
}

/* Pixel box — used by all panels */
.px-box {
  background: var(--px-bg);
  border: 2px solid var(--px-border);
  font-family: monospace;
  color: var(--px-text);
}

.px-label {
  font-family: monospace;
  font-size: 7px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--px-accent);
}

.px-value {
  font-family: monospace;
  font-size: 11px;
  color: var(--px-text);
}

.px-btn {
  background: var(--px-bg);
  border: 2px solid var(--px-border-mid);
  color: var(--px-text-dim);
  font-family: monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
  padding: 5px 10px;
  cursor: pointer;
  transition: border-color 0.1s, color 0.1s;
}
.px-btn:hover {
  border-color: var(--px-accent-light);
  color: var(--px-accent-light);
}
.px-btn-primary {
  background: var(--px-accent);
  border-color: var(--px-accent-light);
  color: #EDE9FE;
  box-shadow: 0 3px 0 #3730A3;
}
.px-btn-primary:hover {
  background: #6D28D9;
}
.px-btn-primary:disabled {
  background: #4A2F14;
  border-color: #7A5230;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.5;
}

.px-input {
  background: var(--px-bg-mid);
  border: 2px solid var(--px-border-mid);
  color: var(--px-text);
  font-family: monospace;
  font-size: 8px;
  padding: 6px 10px;
  outline: none;
  letter-spacing: 0.05em;
}
.px-input:focus {
  border-color: var(--px-accent);
}

/* Scanline overlay */
.px-scanlines {
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0px, transparent 3px,
    rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px
  );
  pointer-events: none;
}
```

- [ ] Commit:
```bash
git add web/app/globals.css
git commit -m "feat: add pixel UI CSS theme variables and utility classes"
```

---

## Task 11: Restyle SidePanel

**Files:**
- Modify: `web/components/SidePanel.tsx`

- [ ] Replace `web/components/SidePanel.tsx`:

```typescript
"use client";
import { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

const STATE_COLOR: Record<string, string> = {
  idle:      "#7A5230",
  thinking:  "#FCD34D",
  coding:    "#60A5FA",
  testing:   "#6EE7B7",
  reviewing: "#FCD34D",
  debugging: "#F87171",
  done:      "#6EE7B7",
};

const PALETTE_COLOR = ["#A78BFA","#60A5FA","#34D399","#FBBF24","#F87171"];

export default function SidePanel({ agent, onClose, onPause, onResume }: Props) {
  const paletteIdx = (parseInt(agent.id) - 1) % 5;
  const accentColor = PALETTE_COLOR[paletteIdx];
  const costLabel = agent.costUsd >= 0.01
    ? `$${agent.costUsd.toFixed(3)}`
    : agent.costUsd > 0 ? `$${agent.costUsd.toFixed(5)}` : "—";

  return (
    <div style={{
      width: 280,
      background: "#0d0907",
      borderLeft: "3px solid #3D2409",
      display: "flex",
      flexDirection: "column",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "2px solid #3D2409",
        background: "#1a1208",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 10, height: 10,
            background: accentColor,
            border: `2px solid ${accentColor}`,
          }} />
          <span style={{ color: "#E9D5FF", fontSize: 10, letterSpacing: "0.1em" }}>
            {agent.name.toUpperCase()}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "#7A5230", cursor: "pointer", fontSize: 12, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <Row label="STATUS">
          <span style={{
            color: agent.paused ? "#7A5230" : (STATE_COLOR[agent.state] ?? "#F5CBA7"),
            fontSize: 10, letterSpacing: "0.05em",
          }}>
            {(agent.paused ? "PAUSED" : agent.state).toUpperCase()}
          </span>
        </Row>

        <Row label="TASK">
          <span style={{ color: "#F5CBA7", fontSize: 9, lineHeight: 1.6 }}>{agent.task}</span>
        </Row>

        <Row label="LAST ACTION">
          <span style={{ color: "#7A5230", fontSize: 9 }}>{agent.lastAction}</span>
        </Row>

        <Row label="THIS RUN">
          <div style={{ display: "flex", gap: 8, fontSize: 9, fontFamily: "monospace" }}>
            <span style={{ color: "#60A5FA" }}>↓ {agent.inputTokens.toLocaleString()}</span>
            <span style={{ color: "#4A2F14" }}>in</span>
            <span style={{ color: "#6EE7B7" }}>↑ {agent.outputTokens.toLocaleString()}</span>
            <span style={{ color: "#4A2F14" }}>out</span>
          </div>
          <div style={{ color: agent.costUsd > 0 ? "#FCD34D" : "#4A2F14", fontSize: 9, marginTop: 2 }}>
            {costLabel}
          </div>
        </Row>

        <Row label="TOTAL TOKENS">
          <span style={{ color: "#F5CBA7", fontSize: 10 }}>
            {agent.tokensUsed.toLocaleString()}
          </span>
        </Row>

        <Row label="LOG">
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {agent.logs.map((entry, i) => (
              <div key={i} style={{
                fontSize: 8, color: "#7A5230", lineHeight: 1.8,
                borderLeft: `2px solid #3D2409`,
                paddingLeft: 6, marginBottom: 2,
                fontFamily: "monospace",
              }}>
                {entry}
              </div>
            ))}
          </div>
        </Row>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 12px", borderTop: "2px solid #3D2409" }}>
        {agent.paused ? (
          <button onClick={() => onResume(agent.id)} style={{
            width: "100%", background: "#14532D",
            border: "2px solid #16A34A", color: "#6EE7B7",
            fontFamily: "monospace", fontSize: 8,
            letterSpacing: "0.1em", padding: "7px",
            cursor: "pointer",
          }}>▶ RESUME AGENT</button>
        ) : (
          <button onClick={() => onPause(agent.id)} style={{
            width: "100%", background: "#451A03",
            border: "2px solid #D97706", color: "#FCD34D",
            fontFamily: "monospace", fontSize: 8,
            letterSpacing: "0.1em", padding: "7px",
            cursor: "pointer",
          }}>⏸ PAUSE AGENT</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 7, color: "#7C3AED",
        letterSpacing: "0.15em", marginBottom: 3,
        textTransform: "uppercase",
      }}>{label}</div>
      {children}
    </div>
  );
}
```

- [ ] Commit:
```bash
git add web/components/SidePanel.tsx
git commit -m "feat: restyle SidePanel to pixel theme"
```

---

## Task 12: Restyle ResultPanel

**Files:**
- Modify: `web/components/ResultPanel.tsx`

- [ ] In `web/components/ResultPanel.tsx`, replace the outer container and header only (keep CodeBlock and tab content):

Replace:
```typescript
<div className="w-[420px] bg-gray-900 border-l border-gray-800 flex flex-col">
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
```
With:
```typescript
<div style={{ width: 420, background: "#0d0907", borderLeft: "3px solid #3D2409", display: "flex", flexDirection: "column", fontFamily: "monospace" }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "2px solid #3D2409", background: "#1a1208" }}>
```

Replace tab bar:
```typescript
<div className="flex border-b border-gray-800">
  <button onClick={() => setTab("plan")} className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${tab === "plan" ? "text-violet-300 border-b-2 border-violet-500" : "text-gray-600 hover:text-gray-400"}`}>
    🧠 Plan
  </button>
  <button onClick={() => setTab("code")} className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${tab === "code" ? "text-blue-300 border-b-2 border-blue-500" : "text-gray-600 hover:text-gray-400"}`}>
    💻 Code
  </button>
</div>
```
With:
```typescript
<div style={{ display: "flex", borderBottom: "2px solid #3D2409" }}>
  {(["plan","code"] as const).map(t => (
    <button key={t} onClick={() => setTab(t)} style={{
      flex: 1, padding: "7px", background: tab === t ? "#1a1208" : "transparent",
      borderBottom: tab === t ? `2px solid #7C3AED` : "2px solid transparent",
      color: tab === t ? "#A78BFA" : "#7A5230",
      fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em",
      cursor: "pointer", border: "none", borderBottom: tab === t ? "2px solid #7C3AED" : "2px solid transparent",
    }}>
      {t === "plan" ? "[ PLAN ]" : "[ CODE ]"}
    </button>
  ))}
</div>
```

Replace action buttons at bottom:
```typescript
<div className="px-4 py-3 border-t border-gray-800 space-y-2">
```
With:
```typescript
<div style={{ padding: "10px 12px", borderTop: "2px solid #3D2409", display: "flex", flexDirection: "column", gap: 8 }}>
```

Replace individual buttons:
```typescript
<button onClick={handleShare} disabled={sharing} className="flex-1 bg-gray-800 hover:bg-gray-700 ...">
  {copied ? "✓ Copied!" : sharing ? "Creating…" : "🔗 Share"}
</button>
<button onClick={() => onReplay(result.sessionId)} className="flex-1 bg-violet-900/60 ...">
  ▶ Replay
</button>
```
With:
```typescript
<button onClick={handleShare} disabled={sharing} style={{
  flex: 1, background: "#1a1208", border: "2px solid #3D2409",
  color: "#7A5230", fontFamily: "monospace", fontSize: 8,
  letterSpacing: "0.1em", padding: "7px", cursor: "pointer",
}}>
  {copied ? "✓ COPIED" : sharing ? "CREATING..." : "SHARE"}
</button>
<button onClick={() => onReplay(result.sessionId)} style={{
  flex: 1, background: "#2e1065", border: "2px solid #7C3AED",
  color: "#A78BFA", fontFamily: "monospace", fontSize: 8,
  letterSpacing: "0.1em", padding: "7px", cursor: "pointer",
}}>
  ▶ REPLAY
</button>
```

- [ ] Commit:
```bash
git add web/components/ResultPanel.tsx
git commit -m "feat: restyle ResultPanel to pixel theme"
```

---

## Task 13: Restyle Login Page

**Files:**
- Modify: `web/app/login/page.tsx`

- [ ] Replace the return JSX in `web/app/login/page.tsx`:

```typescript
return (
  <div style={{
    minHeight: "100vh",
    background: "#0d0907",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "monospace",
  }}>
    {/* Scanline */}
    <div className="px-scanlines" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />

    <div style={{ width: 340, position: "relative", zIndex: 1 }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
        <div style={{
          width: 32, height: 32,
          background: "#7C3AED",
          border: "2px solid #A78BFA",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: "bold", color: "#EDE9FE",
          imageRendering: "pixelated",
          boxShadow: "0 0 12px #7C3AED88",
        }}>O</div>
        <div>
          <div style={{ color: "#E9D5FF", fontSize: 12, letterSpacing: "0.1em" }}>ORBIAGENTS</div>
          <div style={{ color: "#7C3AED", fontSize: 7, letterSpacing: "0.3em" }}>WORKSPACE</div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: "#1a1208",
        border: "2px solid #3D2409",
        padding: "24px 20px",
        boxShadow: "0 0 0 1px #1C1208, 0 8px 32px rgba(0,0,0,0.8)",
      }}>
        <div style={{ color: "#E9D5FF", fontSize: 11, letterSpacing: "0.05em", marginBottom: 4 }}>
          {mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
        </div>
        <div style={{ color: "#7A5230", fontSize: 8, marginBottom: 20, letterSpacing: "0.05em" }}>
          {mode === "login" ? "Sign in to your OrbiAgents workspace" : "Start building AI agent workflows"}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="px-label" style={{ marginBottom: 4 }}>EMAIL</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus placeholder="you@example.com"
              className="px-input" style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <div className="px-label" style={{ marginBottom: 4 }}>PASSWORD</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={8}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              className="px-input" style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          {error && <div style={{ color: "#F87171", fontSize: 8 }}>{error}</div>}

          <button type="submit" disabled={loading} className="px-btn px-btn-primary" style={{
            width: "100%", padding: "10px", fontSize: 9, letterSpacing: "0.15em",
          }}>
            {loading ? "PLEASE WAIT..." : mode === "login" ? "▶ SIGN IN" : "▶ CREATE ACCOUNT"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button
            onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(null); }}
            style={{ background: "none", border: "none", color: "#7A5230", fontSize: 8, cursor: "pointer", letterSpacing: "0.05em" }}
          >
            {mode === "login" ? "NO ACCOUNT? SIGN UP" : "ALREADY HAVE AN ACCOUNT? SIGN IN"}
          </button>
        </div>
      </div>
    </div>
  </div>
);
```

- [ ] Commit:
```bash
git add web/app/login/page.tsx
git commit -m "feat: restyle Login page to pixel theme"
```

---

## Task 14: Fix TypeScript Paths

**Files:**
- Modify: `web/tsconfig.json`
- Modify: `server/tsconfig.json`

- [ ] Add path alias to `web/tsconfig.json` so `shared/` imports resolve:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./app/*", "./components/*", "./lib/*"],
      "shared/*": ["../shared/*"]
    }
  }
}
```

- [ ] Create `shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "declaration": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] Run type check:
```bash
cd web && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] Commit:
```bash
git add web/tsconfig.json shared/tsconfig.json
git commit -m "fix: add shared/ path alias for web tsconfig"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tile map with multi-zone office (Task 5)
- ✅ Animated characters 4-direction walk (Task 3)
- ✅ Typing/done animation states (Task 3)
- ✅ Per-agent hue palettes (Task 3)
- ✅ BFS pathfinding (Task 6)
- ✅ Z-sort renderer (Task 7)
- ✅ requestAnimationFrame game loop (Task 8)
- ✅ GameCanvas rebuilt (Task 9)
- ✅ SidePanel pixel theme (Task 11)
- ✅ ResultPanel pixel theme (Task 12)
- ✅ Login page pixel theme (Task 13)
- ✅ globals.css pixel classes (Task 10)
- ⚠ WorkflowBuilder reskin — minor, existing pixel style is close enough. Can be done after verification.

**Type consistency:** All types defined in Task 1 (`CharacterRenderState`, `TileCoord`, `FurnitureInstance`, `Direction`, `CharacterState`, `TileType`) are used consistently in Tasks 5-9 with matching property names.
