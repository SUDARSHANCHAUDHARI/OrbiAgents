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
export const AGENT_HOME_TILES: Record<string, TileCoord> = {
  "1": { col: 5,  row: 5  },
  "2": { col: 14, row: 12 },
  "3": { col: 25, row: 5  },
  "4": { col: 8,  row: 20 },
  "5": { col: 20, row: 22 },
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
