import type { AgentActivityState } from "../../../shared/contracts";

export const ORBITAL_TILE_SIZE = 24;
export const ORBITAL_WORLD_COLUMNS = 40;
export const ORBITAL_WORLD_ROWS = 24;

export type OrbitalTileKind = "void" | "wall" | "deck" | "corridor" | "threshold";
export type OrbitalStationId = "prime" | "planning" | "code" | "terminal" | "review" | "comms" | "recovery" | "lounge";

export interface OrbitalTile { column: number; row: number; kind: OrbitalTileKind; variant: number; }
export interface OrbitalRoom { id: string; label: string; column: number; row: number; width: number; height: number; accent: number; }
export interface OrbitalStation { id: OrbitalStationId; label: string; column: number; row: number; color: number; }
export interface OrbitalWorld { columns: number; rows: number; tileSize: number; tiles: OrbitalTile[]; rooms: OrbitalRoom[]; stations: OrbitalStation[]; }
export interface OrbitalCamera { x: number; y: number; zoom: 1 | 2; viewportWidth: number; viewportHeight: number; }
export interface OrbitalPosition { column: number; row: number; }

const ROOMS: OrbitalRoom[] = [
  { id: "bridge", label: "Command Bridge", column: 2, row: 2, width: 12, height: 8, accent: 0xffd166 },
  { id: "forge", label: "Code Forge", column: 16, row: 2, width: 13, height: 8, accent: 0x5eead4 },
  { id: "comms", label: "Signal Bay", column: 31, row: 2, width: 7, height: 8, accent: 0xa78bfa },
  { id: "lab", label: "Research Lab", column: 2, row: 12, width: 16, height: 10, accent: 0x72e2a8 },
  { id: "review", label: "Review Deck", column: 20, row: 12, width: 18, height: 10, accent: 0xff6b6b },
];

const STATIONS: OrbitalStation[] = [
  { id: "prime", label: "Orbi Prime", column: 7, row: 5, color: 0xffd166 },
  { id: "planning", label: "Mission Table", column: 11, row: 6, color: 0xa78bfa },
  { id: "code", label: "Code Console", column: 20, row: 5, color: 0x5eead4 },
  { id: "terminal", label: "Terminal Rack", column: 26, row: 6, color: 0x72e2a8 },
  { id: "comms", label: "Signal Array", column: 34, row: 5, color: 0xa78bfa },
  { id: "recovery", label: "Recovery Pod", column: 5, row: 17, color: 0xff6b6b },
  { id: "lounge", label: "Orbit Lounge", column: 13, row: 18, color: 0xffd166 },
  { id: "review", label: "Review Wall", column: 29, row: 17, color: 0x5eead4 },
];

const STATE_STATION: Record<AgentActivityState, OrbitalStationId> = {
  idle: "lounge", thinking: "planning", reading: "review", coding: "code", "permission-waiting": "comms", done: "lounge", failed: "recovery",
};

export function createOrbitalWorld(): OrbitalWorld {
  const tiles = Array.from({ length: ORBITAL_WORLD_COLUMNS * ORBITAL_WORLD_ROWS }, (_, index): OrbitalTile => ({
    column: index % ORBITAL_WORLD_COLUMNS,
    row: Math.floor(index / ORBITAL_WORLD_COLUMNS),
    kind: "void",
    variant: (index * 17 + Math.floor(index / ORBITAL_WORLD_COLUMNS) * 13) % 4,
  }));
  for (const room of ROOMS) paintRoom(tiles, room);
  paintCorridor(tiles, 2, 10, 36, 2);
  paintCorridor(tiles, 14, 8, 2, 10);
  paintCorridor(tiles, 18, 10, 2, 7);
  for (const station of STATIONS) setKind(tiles, station.column, station.row, "threshold");
  return { columns: ORBITAL_WORLD_COLUMNS, rows: ORBITAL_WORLD_ROWS, tileSize: ORBITAL_TILE_SIZE, tiles, rooms: ROOMS.map((room) => ({ ...room })), stations: STATIONS.map((station) => ({ ...station })) };
}

export function stationForState(state: AgentActivityState): OrbitalStationId { return STATE_STATION[state]; }
export function stationById(world: OrbitalWorld, id: OrbitalStationId): OrbitalStation { const station = world.stations.find((candidate) => candidate.id === id); if (!station) throw new Error(`Unknown orbital station: ${id}`); return station; }
export function tileAt(world: OrbitalWorld, column: number, row: number): OrbitalTile | null { if (column < 0 || row < 0 || column >= world.columns || row >= world.rows) return null; return world.tiles[row * world.columns + column] ?? null; }
export function isWalkable(tile: OrbitalTile | null): boolean { return Boolean(tile && tile.kind !== "void" && tile.kind !== "wall"); }

export function findOrbitalPath(world: OrbitalWorld, from: OrbitalPosition, to: OrbitalPosition): OrbitalPosition[] {
  if (!isWalkable(tileAt(world, from.column, from.row)) || !isWalkable(tileAt(world, to.column, to.row))) return [];
  const start = positionKey(from); const destination = positionKey(to);
  const queue: OrbitalPosition[] = [{ column: from.column, row: from.row }];
  const previous = new Map<string, OrbitalPosition | null>([[start, null]]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (positionKey(current) === destination) break;
    for (const next of neighbors(current)) {
      const key = positionKey(next);
      if (previous.has(key) || !isWalkable(tileAt(world, next.column, next.row))) continue;
      previous.set(key, current); queue.push(next);
    }
  }
  if (!previous.has(destination)) return [];
  const path: OrbitalPosition[] = [];
  for (let current: OrbitalPosition | null = { column: to.column, row: to.row }; current; current = previous.get(positionKey(current)) ?? null) path.push(current);
  return path.reverse();
}

export function clampOrbitalCamera(camera: OrbitalCamera, world: OrbitalWorld): OrbitalCamera {
  const worldWidth = world.columns * world.tileSize * camera.zoom;
  const worldHeight = world.rows * world.tileSize * camera.zoom;
  return { ...camera, x: clamp(camera.x, Math.min(0, camera.viewportWidth - worldWidth), 0), y: clamp(camera.y, Math.min(0, camera.viewportHeight - worldHeight), 0) };
}

export function centerCameraOn(camera: OrbitalCamera, world: OrbitalWorld, column: number, row: number): OrbitalCamera {
  const x = camera.viewportWidth / 2 - (column + .5) * world.tileSize * camera.zoom;
  const y = camera.viewportHeight / 2 - (row + .5) * world.tileSize * camera.zoom;
  return clampOrbitalCamera({ ...camera, x: Math.round(x), y: Math.round(y) }, world);
}

function paintRoom(tiles: OrbitalTile[], room: OrbitalRoom): void {
  for (let row = room.row; row < room.row + room.height; row += 1) for (let column = room.column; column < room.column + room.width; column += 1) {
    const border = row === room.row || column === room.column || row === room.row + room.height - 1 || column === room.column + room.width - 1;
    setKind(tiles, column, row, border ? "wall" : "deck");
  }
  const doorway = room.column + Math.floor(room.width / 2);
  setKind(tiles, doorway, room.row, "threshold");
  setKind(tiles, doorway, room.row + room.height - 1, "threshold");
}

function paintCorridor(tiles: OrbitalTile[], column: number, row: number, width: number, height: number): void {
  for (let y = row; y < row + height; y += 1) for (let x = column; x < column + width; x += 1) setKind(tiles, x, y, "corridor");
}

function setKind(tiles: OrbitalTile[], column: number, row: number, kind: OrbitalTileKind): void { const tile = tiles[row * ORBITAL_WORLD_COLUMNS + column]; if (tile) tile.kind = kind; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function positionKey(position: OrbitalPosition): string { return `${position.column}:${position.row}`; }
function neighbors(position: OrbitalPosition): OrbitalPosition[] { return [{ column: position.column, row: position.row - 1 }, { column: position.column + 1, row: position.row }, { column: position.column, row: position.row + 1 }, { column: position.column - 1, row: position.row }]; }
