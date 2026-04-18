import { TileType } from "../types";
import type { FurnitureInstance, TileCoord } from "../types";
import {
  DESK_SPRITE, BOOKSHELF_SPRITE, PLANT_SPRITE,
  MEETING_TABLE_SPRITE, CHAIR_SPRITE,
  WHITEBOARD_SPRITE, SOFA_SPRITE, COFFEE_MACHINE_SPRITE,
} from "../sprites/furniture";

export const TILE_SIZE = 16; // px
export const GRID_COLS = 45;
export const GRID_ROWS = 30;

// ── Tile map ───────────────────────────────────────────────────────
// Columns 0-27: workspace wood floor
// Columns 28-44, rows 0-18: tiled collaboration room
// Columns 28-44, rows 19-29: carpet lounge
// Row 0: bookshelf wall (all columns)

export function buildTileMap(): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (r === 0) {
        row.push(TileType.WALL); // bookshelf row
      } else if (c <= 27) {
        row.push(TileType.FLOOR_WOOD);
      } else if (r <= 18) {
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

  // Whiteboard (collaboration room, left of meeting table)
  items.push({
    sprite: WHITEBOARD_SPRITE,
    x: 30 * TS, y: 7 * TS,
    zY: 9 * TS,
  });

  // Sofa (lounge/carpet zone)
  items.push({
    sprite: SOFA_SPRITE,
    x: 34 * TS, y: 22 * TS,
    zY: 24 * TS,
  });

  // Coffee machine (corner near meeting table)
  items.push({
    sprite: COFFEE_MACHINE_SPRITE,
    x: 40 * TS, y: 6 * TS,
    zY: 8 * TS,
  });

  return items;
}

// ── Floor tile colors ──────────────────────────────────────────────
export const FLOOR_COLORS: Record<TileType, string[]> = {
  [TileType.FLOOR_WOOD]:   ["#34261D", "#412F24", "#4C3729", "#2B2119"],
  [TileType.FLOOR_TILE]:   ["#374151", "#445064", "#55627A", "#313B4D"],
  [TileType.FLOOR_CARPET]: ["#1A2640", "#223150", "#1F2B46", "#162238"],
  [TileType.WALL]:         ["#241812"],
  [TileType.VOID]:         [],
};

export function getFloorColor(tileType: TileType, col: number, row: number): string {
  const colors = FLOOR_COLORS[tileType];
  if (!colors || colors.length === 0) return "";
  return colors[(col + row) % colors.length];
}
