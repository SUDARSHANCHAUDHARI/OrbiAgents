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
