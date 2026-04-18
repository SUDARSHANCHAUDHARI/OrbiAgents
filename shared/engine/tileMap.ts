import { TileType } from "../types";
import type { FurnitureInstance, TileCoord } from "../types";
import {
  DESK_SPRITE, BOOKSHELF_SPRITE, PLANT_SPRITE,
  MEETING_TABLE_SPRITE, CHAIR_SPRITE,
  WHITEBOARD_SPRITE, SOFA_SPRITE, COFFEE_MACHINE_SPRITE,
} from "../sprites/furniture";

export const TILE_SIZE = 16; // px

// ── Proportional zone splits ───────────────────────────────────────
// Workspace (wood): left 62% of cols
// Collaboration (tile): right 38%, top 63% of rows
// Lounge (carpet): right 38%, bottom 37% of rows
// Row 0: bookshelf wall across all columns

export function buildTileMap(cols: number, rows: number): TileType[][] {
  const splitCol = Math.round(cols * 0.62);
  const splitRow = Math.round(rows * 0.63);
  const map: TileType[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < cols; c++) {
      if (r === 0) {
        row.push(TileType.WALL);
      } else if (c <= splitCol) {
        row.push(TileType.FLOOR_WOOD);
      } else if (r <= splitRow) {
        row.push(TileType.FLOOR_TILE);
      } else {
        row.push(TileType.FLOOR_CARPET);
      }
    }
    map.push(row);
  }
  return map;
}

// ── Agent home tiles — proportional to grid size ───────────────────
export function buildAgentHomeTiles(cols: number, rows: number): Record<string, TileCoord> {
  const c = (f: number) => Math.max(2, Math.min(cols - 3, Math.round(cols * f)));
  const r = (f: number) => Math.max(2, Math.min(rows - 3, Math.round(rows * f)));
  return {
    "1": { col: c(0.11), row: r(0.17) },
    "2": { col: c(0.31), row: r(0.40) },
    "3": { col: c(0.56), row: r(0.17) },
    "4": { col: c(0.18), row: r(0.67) },
    "5": { col: c(0.44), row: r(0.73) },
  };
}

// ── Furniture layout — proportional to grid size ───────────────────
export function buildFurnitureInstances(cols: number, rows: number): FurnitureInstance[] {
  const items: FurnitureInstance[] = [];
  const TS = TILE_SIZE;

  // Bookshelves across row 0
  for (let c = 0; c < cols; c++) {
    items.push({ sprite: BOOKSHELF_SPRITE, x: c * TS, y: 0, zY: 0 });
  }

  // Desks at each agent home
  const homeTiles = buildAgentHomeTiles(cols, rows);
  Object.values(homeTiles).forEach(({ col, row }) => {
    items.push({
      sprite: DESK_SPRITE,
      x: (col - 1) * TS,
      y: (row - 1) * TS,
      zY: row * TS,
    });
  });

  // Plants — proportional corners (inside workspace zone)
  const px1 = Math.max(3, Math.round(cols * 0.07));
  const px2 = Math.max(px1 + 4, Math.round(cols * 0.62));
  const pr1 = Math.max(3, Math.round(rows * 0.10));
  const pr2 = Math.max(pr1 + 4, Math.min(rows - 3, Math.round(rows * 0.87)));
  [[px1, pr1], [px2, pr1], [px1, pr2], [px2, pr2]].forEach(([c, r]) => {
    if (c < cols && r < rows) {
      items.push({ sprite: PLANT_SPRITE, x: c * TS, y: r * TS, zY: (r + 1) * TS });
    }
  });

  // Meeting table — collaboration zone
  const tableCol = Math.max(Math.round(cols * 0.62) + 2, 5);
  const tableRow = Math.max(Math.round(rows * 0.20), 3);
  if (tableCol + 3 < cols && tableRow + 2 < rows) {
    items.push({
      sprite: MEETING_TABLE_SPRITE,
      x: tableCol * TS, y: tableRow * TS,
      zY: (tableRow + 2) * TS,
    });
  }

  // Chairs around meeting table
  const chairOffsets = [[1, 7], [5, 7], [1, 12], [5, 12]];
  chairOffsets.forEach(([dc, dr]) => {
    const c = tableCol + dc;
    const r = tableRow + dr;
    if (c < cols - 1 && r < rows - 1) {
      items.push({ sprite: CHAIR_SPRITE, x: c * TS, y: r * TS, zY: (r + 1) * TS });
    }
  });

  // Whiteboard — left of meeting table
  const wbCol = tableCol - 2;
  const wbRow = tableRow + 1;
  if (wbCol >= 0 && wbRow + 2 < rows) {
    items.push({ sprite: WHITEBOARD_SPRITE, x: wbCol * TS, y: wbRow * TS, zY: (wbRow + 2) * TS });
  }

  // Sofa — lounge zone below meeting table
  const sofaRow = Math.min(Math.round(rows * 0.77), rows - 3);
  if (tableCol + 2 < cols && sofaRow < rows - 1) {
    items.push({ sprite: SOFA_SPRITE, x: (tableCol + 2) * TS, y: sofaRow * TS, zY: (sofaRow + 2) * TS });
  }

  // Coffee machine — corner of collab zone
  const coffeeCol = Math.min(tableCol + 8, cols - 2);
  if (coffeeCol < cols - 1 && tableRow < rows - 2) {
    items.push({ sprite: COFFEE_MACHINE_SPRITE, x: coffeeCol * TS, y: tableRow * TS, zY: (tableRow + 1) * TS });
  }

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
