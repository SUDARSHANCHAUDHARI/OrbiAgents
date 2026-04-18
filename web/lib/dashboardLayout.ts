"use client";

import type { Agent } from "@/lib/types";
import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "../../shared/engine/tileMap";
import type { FurnitureInstance, TileCoord } from "../../shared/types";
import {
  BOOKSHELF_SPRITE,
  CHAIR_SPRITE,
  DESK_SPRITE,
  MEETING_TABLE_SPRITE,
  PLANT_SPRITE,
} from "../../shared/sprites/furniture";

export const HEADER_HEIGHT = 64;
export const SIDEBAR_WIDTH = 320;
export const PADDING = 2;
export const AGENT_SIZE = {
  widthTiles: 2,
  heightTiles: 3,
};

const CENTER_ZONE = {
  minCol: 6,
  maxCol: 24,
  minRow: 5,
  maxRow: 22,
};

const FULL_MAP_BOUNDS = {
  minCol: 0,
  maxCol: GRID_COLS - 1,
  minRow: 0,
  maxRow: GRID_ROWS - 1,
};

type Bounds = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

export interface DashboardViewport {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
}

export interface NamedAgentLayout {
  id: string;
  name: string;
  state: Agent["state"];
  paused: boolean;
  homeTile: TileCoord;
}

export interface OfficeLayout {
  agents: NamedAgentLayout[];
  homeTiles: Record<string, TileCoord>;
  furniture: FurnitureInstance[];
  contentBounds: Bounds;
}

export function calculateViewport(width: number, height: number): DashboardViewport {
  return {
    width,
    height,
    contentWidth: Math.max(0, width),
    contentHeight: Math.max(0, height),
  };
}

export function ensureUniqueAgentNames(agents: Agent[]): Map<string, string> {
  const seen = new Map<string, number>();
  const unique = new Map<string, string>();

  agents.forEach((agent) => {
    const base = agent.name.trim() || `Orbi-Agent-${agent.id}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    unique.set(agent.id, count === 1 ? base : `${base}-${count}`);
  });

  return unique;
}

export function layoutAgents(agents: Agent[], viewport: DashboardViewport): OfficeLayout {
  const uniqueNames = ensureUniqueAgentNames(agents);
  if (agents.length === 0) {
    const idleBounds = {
      minCol: CENTER_ZONE.minCol,
      maxCol: CENTER_ZONE.maxCol + 7,
      minRow: CENTER_ZONE.minRow - 1,
      maxRow: CENTER_ZONE.maxRow + 2,
    };

    return {
      agents: [],
      homeTiles: {},
      furniture: placeFurniture({}, idleBounds),
      contentBounds: idleBounds,
    };
  }

  const grid = resolveGrid(agents.length, viewport);
  // Keep agents inside a centered safe zone first, then let decor use the outer ring.
  const placementBounds = resolvePlacementBounds(grid.columns, grid.rows);
  const usableWidth = placementBounds.maxCol - placementBounds.minCol;
  const usableHeight = placementBounds.maxRow - placementBounds.minRow;
  const spacingX = usableWidth / Math.max(1, grid.columns - 1 || 1);
  const spacingY = usableHeight / Math.max(1, grid.rows - 1 || 1);

  const laidOutAgents: NamedAgentLayout[] = [];
  const occupied = new Set<string>();

  agents.forEach((agent, index) => {
    const row = Math.floor(index / grid.columns);
    const col = index % grid.columns;

    const desiredCol = grid.columns === 1
      ? Math.round((placementBounds.minCol + placementBounds.maxCol) / 2)
      : Math.round(placementBounds.minCol + spacingX * col);
    const desiredRow = grid.rows === 1
      ? Math.round((placementBounds.minRow + placementBounds.maxRow) / 2)
      : Math.round(placementBounds.minRow + spacingY * row);

    const homeTile = reserveNearestOpenTile(desiredCol, desiredRow, occupied, placementBounds);
    occupied.add(`${homeTile.col}:${homeTile.row}`);

    laidOutAgents.push({
      id: agent.id,
      name: uniqueNames.get(agent.id) ?? agent.name,
      state: agent.state,
      paused: agent.paused,
      homeTile,
    });
  });

  const homeTiles = Object.fromEntries(laidOutAgents.map((agent) => [agent.id, agent.homeTile]));
  const agentBounds = expandBounds(getBounds(Object.values(homeTiles)), PADDING, FULL_MAP_BOUNDS);
  // Camera bounds intentionally include a little decor room without expanding to the whole map.
  const contentBounds = expandBounds(
    {
      minCol: Math.max(0, agentBounds.minCol - 2),
      maxCol: Math.min(GRID_COLS - 1, agentBounds.maxCol + 9),
      minRow: Math.max(1, agentBounds.minRow - 4),
      maxRow: Math.min(GRID_ROWS - 1, agentBounds.maxRow + 4),
    },
    0,
    FULL_MAP_BOUNDS,
  );
  const furniture = placeFurniture(homeTiles, contentBounds);

  return {
    agents: laidOutAgents,
    homeTiles,
    furniture,
    contentBounds,
  };
}

export function calculateCamera(
  viewport: DashboardViewport,
  bounds: Bounds,
): { zoom: number; offsetX: number; offsetY: number } {
  const widthTiles = bounds.maxCol - bounds.minCol + 1;
  const heightTiles = bounds.maxRow - bounds.minRow + 1;
  const contentWidth = widthTiles * TILE_SIZE;
  const contentHeight = heightTiles * TILE_SIZE;
  const zoom = clamp(
    Math.min(viewport.contentWidth / contentWidth, viewport.contentHeight / contentHeight),
    1.45,
    2.15,
  );

  const offsetX =
    Math.round((viewport.contentWidth - contentWidth * zoom) / 2) - bounds.minCol * TILE_SIZE * zoom;
  const offsetY =
    Math.round((viewport.contentHeight - contentHeight * zoom) / 2) - bounds.minRow * TILE_SIZE * zoom;

  return { zoom, offsetX, offsetY };
}

export function calculateFocusedCamera(
  viewport: DashboardViewport,
  bounds: Bounds,
  focusTile: TileCoord,
): { zoom: number; offsetX: number; offsetY: number } {
  const base = calculateCamera(viewport, bounds);
  const focusX = focusTile.col * TILE_SIZE * base.zoom + base.offsetX;
  const focusY = focusTile.row * TILE_SIZE * base.zoom + base.offsetY;
  const safeLeft = viewport.contentWidth * 0.34;
  const safeRight = viewport.contentWidth * 0.66;
  const safeTop = viewport.contentHeight * 0.28;
  const safeBottom = viewport.contentHeight * 0.62;

  let focusOffsetX = base.offsetX;
  let focusOffsetY = base.offsetY;

  if (focusX < safeLeft) {
    focusOffsetX += safeLeft - focusX;
  } else if (focusX > safeRight) {
    focusOffsetX -= focusX - safeRight;
  }

  if (focusY < safeTop) {
    focusOffsetY += safeTop - focusY;
  } else if (focusY > safeBottom) {
    focusOffsetY -= focusY - safeBottom;
  }

  const minOffsetX = viewport.contentWidth - (bounds.maxCol + 1) * TILE_SIZE * base.zoom;
  const maxOffsetX = -bounds.minCol * TILE_SIZE * base.zoom;
  const minOffsetY = viewport.contentHeight - (bounds.maxRow + 1) * TILE_SIZE * base.zoom;
  const maxOffsetY = -bounds.minRow * TILE_SIZE * base.zoom;

  return {
    zoom: base.zoom,
    offsetX: clamp(focusOffsetX, minOffsetX, maxOffsetX),
    offsetY: clamp(focusOffsetY, minOffsetY, maxOffsetY),
  };
}

function resolveGrid(count: number, viewport: DashboardViewport): { columns: number; rows: number } {
  if (count <= 3) {
    return { columns: count, rows: 1 };
  }

  const aspectBias = viewport.contentWidth > viewport.contentHeight ? 1.15 : 1;
  const columns = count >= 9
    ? Math.ceil(Math.sqrt(count * aspectBias))
    : Math.ceil(Math.sqrt(count));

  return {
    columns,
    rows: Math.ceil(count / columns),
  };
}

function resolvePlacementBounds(columns: number, rows: number): Bounds {
  if (columns <= 3 && rows === 1) {
    return {
      minCol: 9,
      maxCol: 22,
      minRow: 10,
      maxRow: 14,
    };
  }

  if (columns <= 3 && rows <= 2) {
    return {
      minCol: 8,
      maxCol: 24,
      minRow: 8,
      maxRow: 18,
    };
  }

  return CENTER_ZONE;
}

function reserveNearestOpenTile(
  col: number,
  row: number,
  occupied: Set<string>,
  bounds: Bounds,
): TileCoord {
  const candidates: TileCoord[] = [{ col, row }];

  for (let radius = 1; radius <= 4; radius++) {
    for (let y = row - radius; y <= row + radius; y++) {
      for (let x = col - radius; x <= col + radius; x++) {
        candidates.push({
          col: clamp(x, bounds.minCol, bounds.maxCol),
          row: clamp(y, bounds.minRow, bounds.maxRow),
        });
      }
    }
  }

  for (const candidate of candidates) {
    const key = `${candidate.col}:${candidate.row}`;
    if (!occupied.has(key)) {
      return candidate;
    }
  }

  return { col, row };
}

export function placeFurniture(homeTiles: Record<string, TileCoord>, contentBounds: Bounds): FurnitureInstance[] {
  const items: FurnitureInstance[] = [];
  const occupied = new Set<string>(Object.values(homeTiles).map((tile) => `${tile.col}:${tile.row}`));
  const reserveTile = (tile: TileCoord, padding = 0) => {
    for (let row = tile.row - padding; row <= tile.row + padding; row++) {
      for (let col = tile.col - padding; col <= tile.col + padding; col++) {
        occupied.add(`${col}:${row}`);
      }
    }
  };
  const canPlace = (tile: TileCoord, padding = 0) => {
    for (let row = tile.row - padding; row <= tile.row + padding; row++) {
      for (let col = tile.col - padding; col <= tile.col + padding; col++) {
        if (occupied.has(`${col}:${row}`)) return false;
      }
    }
    return true;
  };

  const shelfStart = clamp(contentBounds.minCol, 0, GRID_COLS - 1);
  const shelfEnd = clamp(contentBounds.maxCol - 2, shelfStart, GRID_COLS - 1);
  for (let col = shelfStart; col <= shelfEnd; col++) {
    items.push({
      sprite: BOOKSHELF_SPRITE,
      x: col * TILE_SIZE,
      y: 0,
      zY: 0,
    });
  }

  Object.values(homeTiles).forEach(({ col, row }) => {
    items.push({
      sprite: DESK_SPRITE,
      x: (col - 1) * TILE_SIZE,
      y: (row - 1) * TILE_SIZE,
      zY: row * TILE_SIZE,
    });
    reserveTile({ col, row }, 1);
  });

  const plantCandidates: TileCoord[] = [
    { col: Math.max(2, contentBounds.minCol + 1), row: Math.max(2, contentBounds.minRow + 1) },
    { col: Math.min(contentBounds.maxCol - 1, GRID_COLS - 3), row: Math.max(2, contentBounds.minRow + 1) },
    { col: Math.max(2, contentBounds.minCol + 1), row: Math.min(contentBounds.maxRow - 1, GRID_ROWS - 3) },
    { col: Math.min(contentBounds.maxCol - 1, GRID_COLS - 3), row: Math.min(contentBounds.maxRow - 1, GRID_ROWS - 3) },
  ];

  plantCandidates.forEach((tile) => {
    if (canPlace(tile, 0)) {
      items.push({
        sprite: PLANT_SPRITE,
        x: tile.col * TILE_SIZE,
        y: tile.row * TILE_SIZE,
        zY: (tile.row + 1) * TILE_SIZE,
      });
      reserveTile(tile, 0);
    }
  });

  const consoleCandidates = [
    { tile: { col: contentBounds.minCol + 1, row: contentBounds.minRow + 4 }, mirrored: false },
    { tile: { col: contentBounds.minCol + 1, row: contentBounds.maxRow - 3 }, mirrored: false },
    { tile: { col: contentBounds.maxCol - 3, row: contentBounds.minRow + 4 }, mirrored: true },
    { tile: { col: contentBounds.maxCol - 3, row: contentBounds.maxRow - 3 }, mirrored: true },
  ];

  consoleCandidates.forEach(({ tile, mirrored }) => {
    if (!canPlace(tile, 1)) return;
    items.push({
      sprite: DESK_SPRITE,
      x: tile.col * TILE_SIZE,
      y: tile.row * TILE_SIZE,
      zY: (tile.row + 1) * TILE_SIZE,
      mirrored,
    });
    reserveTile(tile, 1);
  });

  const decorStartCol = Math.min(contentBounds.maxCol + 1, GRID_COLS - 8);
  const tableCol = clamp(Math.max(decorStartCol, 28), 28, GRID_COLS - 7);
  const tableRow = clamp(
    Math.round((contentBounds.minRow + contentBounds.maxRow) / 2) - 5,
    8,
    GRID_ROWS - 13,
  );
  items.push({
    sprite: MEETING_TABLE_SPRITE,
    x: tableCol * TILE_SIZE,
    y: tableRow * TILE_SIZE,
    zY: (tableRow + 2) * TILE_SIZE,
  });
  reserveTile({ col: tableCol + 3, row: tableRow + 1 }, 2);

  [
    { col: tableCol + 1, row: tableRow + 7 },
    { col: tableCol + 5, row: tableRow + 7 },
    { col: tableCol + 1, row: tableRow + 12 },
    { col: tableCol + 5, row: tableRow + 12 },
    { col: tableCol + 2, row: tableRow + 3 },
    { col: tableCol + 6, row: tableRow + 3 },
  ].forEach((tile) => {
    if (tile.col < GRID_COLS - 1 && tile.row < GRID_ROWS - 1 && canPlace(tile, 0)) {
      items.push({
        sprite: CHAIR_SPRITE,
        x: tile.col * TILE_SIZE,
        y: tile.row * TILE_SIZE,
        zY: (tile.row + 1) * TILE_SIZE,
      });
      reserveTile(tile, 0);
    }
  });

  const loungeCandidates = [
    { col: tableCol + 1, row: contentBounds.maxRow - 5 },
    { col: tableCol + 5, row: contentBounds.maxRow - 5 },
    { col: tableCol + 1, row: contentBounds.maxRow - 1 },
    { col: tableCol + 5, row: contentBounds.maxRow - 1 },
  ];

  loungeCandidates.forEach((tile) => {
    if (!canPlace(tile, 0) || tile.row >= GRID_ROWS - 1) return;
    items.push({
      sprite: CHAIR_SPRITE,
      x: tile.col * TILE_SIZE,
      y: tile.row * TILE_SIZE,
      zY: (tile.row + 1) * TILE_SIZE,
      mirrored: tile.col % 2 === 0,
    });
    reserveTile(tile, 0);
  });

  const accentPlants = [
    { col: tableCol + 1, row: tableRow - 1 },
    { col: tableCol + 7, row: tableRow - 1 },
    { col: tableCol + 1, row: contentBounds.maxRow - 2 },
    { col: tableCol + 7, row: contentBounds.maxRow - 2 },
  ];

  accentPlants.forEach((tile) => {
    if (!canPlace(tile, 0) || tile.row >= GRID_ROWS) return;
    items.push({
      sprite: PLANT_SPRITE,
      x: tile.col * TILE_SIZE,
      y: tile.row * TILE_SIZE,
      zY: (tile.row + 1) * TILE_SIZE,
    });
    reserveTile(tile, 0);
  });

  return items;
}

function getBounds(tiles: TileCoord[]): Bounds {
  if (tiles.length === 0) {
    return CENTER_ZONE;
  }

  return {
    minCol: Math.min(...tiles.map((tile) => tile.col)),
    maxCol: Math.max(...tiles.map((tile) => tile.col)),
    minRow: Math.min(...tiles.map((tile) => tile.row)),
    maxRow: Math.max(...tiles.map((tile) => tile.row)),
  };
}

function expandBounds(bounds: Bounds, padding: number, limits: Bounds): Bounds {
  return {
    minCol: clamp(bounds.minCol - padding, limits.minCol, limits.maxCol),
    maxCol: clamp(bounds.maxCol + padding, limits.minCol, limits.maxCol),
    minRow: clamp(bounds.minRow - padding, limits.minRow, limits.maxRow),
    maxRow: clamp(bounds.maxRow + padding, limits.minRow, limits.maxRow),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
