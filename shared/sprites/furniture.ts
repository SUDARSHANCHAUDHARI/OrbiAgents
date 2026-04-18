import type { SpriteData } from "../types";

function s(rows: string[], pal: Record<string, string>): SpriteData {
  return rows.map(row =>
    Array.from(row).map(ch => (ch === "." ? "" : (pal[ch] ?? "")))
  );
}

// ── Desk with monitor (32×16) ──────────────────────────────────────
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
  W: "#2B1B12", // wood dark
  w: "#4B3224", // wood mid
  R: "#9F3A32", // muted red
  B: "#315F9D", // muted blue
  G: "#2F7A67", // muted green
  Y: "#A06D22", // muted amber
  P: "#6A4A9B", // muted violet
  O: "#9D5B2F", // muted orange
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

// ── Plant (16×12) ──────────────────────────────────────────────────
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

// ── Meeting table (48×10) ──────────────────────────────────────────
const MT_PAL = {
  T: "#0F766E",
  t: "#0D9488",
  d: "#0F5A52",
  L: "#134E4A",
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

// ── Whiteboard (32×20) ────────────────────────────────────────────
const WB_PAL = {
  F: "#F1F5F9", // board surface
  f: "#E2E8F0", // board mid
  R: "#EF4444", // red marker line
  B: "#3B82F6", // blue marker line
  G: "#22C55E", // green marker line
  K: "#1E293B", // frame dark
  k: "#334155", // frame mid
  L: "#CBD5E1", // legs
};
export const WHITEBOARD_SPRITE: SpriteData = s([
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",
  "KFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFk",
  "KFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFk",
  "KFfRRRRRRRRRRffffffffffffffffffk",
  "KFfRRRRRRRRRRffffffffffffffffffk",
  "KFffffffffffBBBBBBBBBffffffffffk",
  "KFffffffffffBBBBBBBBBffffffffffk",
  "KFffffffffffffffffffffGGGGGGGffk",
  "KFffffffffffffffffffffGGGGGGGffk",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KFfffffffffffffffffffffffffffffff",
  "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk",
  "....LLLL......................LLLL",
  "....LLLL......................LLLL",
], WB_PAL);

// ── Coffee machine (16×14) ────────────────────────────────────────
const CM_PAL = {
  A: "#1F2937", // body dark
  a: "#374151", // body mid
  B: "#111827", // button panel
  b: "#6B7280", // button
  W: "#F9FAFB", // cup white
  w: "#E5E7EB", // cup mid
  C: "#92400E", // coffee brown
  S: "#D97706", // steam amber
  T: "#4B5563", // tray
};
export const COFFEE_MACHINE_SPRITE: SpriteData = s([
  "AAAAAAAAAAAAAAAA",
  "AaaaaaaaaaaaaaAA",
  "AaBBBBBBBBBBaaAA",
  "AaBbbbBbbbBbaaAA",
  "AaBBBBBBBBBBaaAA",
  "AaaaaaaaaaaaaaAA",
  "AaaaaaaaaaaaaaAA",
  "AaaaaWWWWaaaaaAA",
  "AaaaaWCCWaaaaaAA",
  "AaaaaWCCWaaaaaAA",
  "AaaaaWwwWaaaaaAA",
  "AAAAAAAAAAAAAAAA",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
], CM_PAL);

// ── Sofa (32×12) ──────────────────────────────────────────────────
const SF_PAL = {
  A: "#7C3AED", // cushion dark
  a: "#8B5CF6", // cushion mid
  B: "#6D28D9", // frame dark
  b: "#7C3AED", // frame mid
  L: "#1E1B4B", // legs
  s: "#A78BFA", // highlight
};
export const SOFA_SPRITE: SpriteData = s([
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "BAaaaaaAAAAAAAAAAAAAAAAAAAaaaaAB",
  "BAasssaAAAAAAAAAAAAAAAAAAAasssAB",
  "BAasssaAAAAAAAAAAAAAAAAAAAasssAB",
  "BAasssaAAAAAAAAAAAAAAAAAAAasssAB",
  "BAaaaaaAAAAAAAAAAAAAAAAAAAaaaaAB",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBB",
  "BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBB",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "LL............................LL.",
  "LL............................LL.",
], SF_PAL);

// ── Lounge chair (16×10) ──────────────────────────────────────────
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
