import type { SpriteData } from "../types";
import { Direction } from "../types";
import { flipHorizontal } from "../engine/spriteCache";

function s(rows: string[], pal: Record<string, string>): SpriteData {
  return rows.map(row =>
    Array.from(row).map(ch => (ch === "." ? "" : (pal[ch] ?? "")))
  );
}

const BASE: Record<string, string> = {
  H: "#4C1D95",
  h: "#6D28D9",
  S: "#FBBF24",
  E: "#1F2937",
  B: "#7C3AED",
  b: "#5B21B6",
  A: "#6D28D9",
  P: "#1E3A5F",
  p: "#162D47",
  K: "#111827",
};

const PALETTE_OVERRIDES: Array<Partial<Record<string, string>>> = [
  {},
  { H:"#1E3A8A", h:"#2563EB", B:"#3B82F6", b:"#1D4ED8", A:"#2563EB" },
  { H:"#14532D", h:"#16A34A", B:"#22C55E", b:"#15803D", A:"#16A34A" },
  { H:"#78350F", h:"#D97706", B:"#F59E0B", b:"#B45309", A:"#D97706" },
  { H:"#881337", h:"#E11D48", B:"#F43F5E", b:"#BE123C", A:"#E11D48" },
];

function makePal(idx: number): Record<string, string> {
  const overrides = PALETTE_OVERRIDES[idx] ?? {};
  const merged: Record<string, string> = { ...BASE };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) merged[k] = v;
  }
  return merged;
}

function buildDownFrames(pal: Record<string, string>): [SpriteData, SpriteData, SpriteData, SpriteData] {
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
      [Direction.UP]:    typingDown,
      [Direction.RIGHT]: typingDown,
      [Direction.LEFT]:  typingLeft,
    },
    done: buildDoneFrame(pal),
  };

  _cache.set(idx, sprites);
  return sprites;
}
