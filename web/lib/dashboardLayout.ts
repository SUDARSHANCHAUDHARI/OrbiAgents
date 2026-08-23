"use client";

import type { Agent } from "@/lib/types";
import { TILE_SIZE } from "../../shared/engine/tileMap";
import type { FurnitureInstance, TileCoord } from "../../shared/types";
import { assignCoworkingTiles, buildCoworkingZones, type CoworkingZoneId } from "../../shared/world/coworking";
import {
  BOOKSHELF_SPRITE,
  CHAIR_SPRITE,
  COFFEE_MACHINE_SPRITE,
  DESK_SPRITE,
  MEETING_TABLE_SPRITE,
  PLANT_SPRITE,
  SOFA_SPRITE,
  WHITEBOARD_SPRITE,
} from "../../shared/sprites/furniture";

export const HEADER_HEIGHT = 64;
export const SIDEBAR_WIDTH = 320;
export const PADDING = 2;
export const AGENT_SIZE = {
  widthTiles: 2,
  heightTiles: 3,
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
  gridCols: number;
  gridRows: number;
}

export interface NamedAgentLayout {
  id: string;
  name: string;
  state: Agent["state"];
  paused: boolean;
  homeTile: TileCoord;
  zoneId: CoworkingZoneId;
}

export interface OfficeLayout {
  agents: NamedAgentLayout[];
  homeTiles: Record<string, TileCoord>;
  furniture: FurnitureInstance[];
  contentBounds: Bounds;
  zones: ReturnType<typeof buildCoworkingZones>;
}

export function calculateViewport(width: number, height: number): DashboardViewport {
  return {
    width,
    height,
    contentWidth: Math.max(0, width),
    contentHeight: Math.max(0, height),
    gridCols: Math.max(20, Math.ceil(width / TILE_SIZE)),
    gridRows: Math.max(15, Math.ceil(height / TILE_SIZE)),
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
  const { gridCols, gridRows } = viewport;
  const zones = buildCoworkingZones(gridCols, gridRows);
  const contentBounds: Bounds = {
    minCol: Math.min(...zones.map((zone) => zone.minCol)),
    maxCol: Math.max(...zones.map((zone) => zone.maxCol)),
    minRow: Math.min(...zones.map((zone) => zone.minRow)),
    maxRow: Math.max(...zones.map((zone) => zone.maxRow)),
  };
  const uniqueNames = ensureUniqueAgentNames(agents);
  if (agents.length === 0) {
    return {
      agents: [],
      homeTiles: {},
      furniture: placeFurniture({}, contentBounds, gridCols, gridRows),
      contentBounds,
      zones,
    };
  }

  const assignment = assignCoworkingTiles(agents, gridCols, gridRows);
  const laidOutAgents: NamedAgentLayout[] = agents.map((agent) => ({
      id: agent.id,
      name: uniqueNames.get(agent.id) ?? agent.name,
      state: agent.state,
      paused: agent.paused,
      homeTile: assignment.tiles[agent.id],
      zoneId: assignment.zones[agent.id],
    }));

  const homeTiles = Object.fromEntries(laidOutAgents.map((agent) => [agent.id, agent.homeTile]));
  const furniture = placeFurniture({}, contentBounds, gridCols, gridRows);

  return {
    agents: laidOutAgents,
    homeTiles,
    furniture,
    contentBounds,
    zones,
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

export function placeFurniture(homeTiles: Record<string, TileCoord>, contentBounds: Bounds, gridCols: number, gridRows: number): FurnitureInstance[] {
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

  const shelfStart = clamp(contentBounds.minCol, 0, gridCols - 1);
  const shelfEnd = clamp(contentBounds.maxCol - 2, shelfStart, gridCols - 1);
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
    { col: Math.min(contentBounds.maxCol - 1, gridCols - 3), row: Math.max(2, contentBounds.minRow + 1) },
    { col: Math.max(2, contentBounds.minCol + 1), row: Math.min(contentBounds.maxRow - 1, gridRows - 3) },
    { col: Math.min(contentBounds.maxCol - 1, gridCols - 3), row: Math.min(contentBounds.maxRow - 1, gridRows - 3) },
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

  const decorMinCol = Math.floor(gridCols * 0.62);
  const decorStartCol = Math.min(contentBounds.maxCol + 1, gridCols - 8);
  const tableCol = clamp(Math.max(decorStartCol, decorMinCol), decorMinCol, gridCols - 7);
  const tableRow = clamp(
    Math.round((contentBounds.minRow + contentBounds.maxRow) / 2) - 5,
    Math.max(3, Math.floor(gridRows * 0.10)),
    Math.max(3, gridRows - 13),
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
    if (tile.col < gridCols - 1 && tile.row < gridRows - 1 && canPlace(tile, 0)) {
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
    if (!canPlace(tile, 0) || tile.row >= gridRows - 1) return;
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
    if (!canPlace(tile, 0) || tile.row >= gridRows) return;
    items.push({
      sprite: PLANT_SPRITE,
      x: tile.col * TILE_SIZE,
      y: tile.row * TILE_SIZE,
      zY: (tile.row + 1) * TILE_SIZE,
    });
    reserveTile(tile, 0);
  });

  // Whiteboard — left wall of collaboration zone
  const wbTile = { col: tableCol, row: tableRow + 1 };
  if (canPlace(wbTile, 0) && wbTile.col < gridCols - 2 && wbTile.row < gridRows - 2) {
    items.push({
      sprite: WHITEBOARD_SPRITE,
      x: wbTile.col * TILE_SIZE,
      y: wbTile.row * TILE_SIZE,
      zY: (wbTile.row + 1) * TILE_SIZE,
    });
    reserveTile(wbTile, 1);
  }

  // Sofa — lounge area below meeting table
  const sofaTile = { col: tableCol + 1, row: contentBounds.maxRow - 3 };
  if (canPlace(sofaTile, 0) && sofaTile.row < gridRows - 2) {
    items.push({
      sprite: SOFA_SPRITE,
      x: sofaTile.col * TILE_SIZE,
      y: sofaTile.row * TILE_SIZE,
      zY: (sofaTile.row + 1) * TILE_SIZE,
    });
    reserveTile(sofaTile, 1);
  }

  // Coffee machine — corner near collaboration zone
  const coffeeTile = { col: tableCol + 7, row: tableRow };
  if (canPlace(coffeeTile, 0) && coffeeTile.col < gridCols - 1) {
    items.push({
      sprite: COFFEE_MACHINE_SPRITE,
      x: coffeeTile.col * TILE_SIZE,
      y: coffeeTile.row * TILE_SIZE,
      zY: (coffeeTile.row + 1) * TILE_SIZE,
    });
    reserveTile(coffeeTile, 0);
  }

  return items;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
