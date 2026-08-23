import type { TileCoord } from "../types";

export type CoworkingZoneId = "focus" | "planning" | "collaboration" | "lounge";

export interface CoworkingZone {
  id: CoworkingZoneId;
  label: string;
  purpose: string;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  anchor: TileCoord;
  color: string;
}

export interface CoworkingAgent {
  id: string;
  state: string;
  paused?: boolean;
}

const STATE_ZONE: Record<string, CoworkingZoneId> = {
  thinking: "planning",
  reading: "planning",
  reviewing: "collaboration",
  testing: "collaboration",
  "permission-waiting": "collaboration",
  coding: "focus",
  debugging: "focus",
  idle: "lounge",
  done: "lounge",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function buildCoworkingZones(cols: number, rows: number): CoworkingZone[] {
  const safeCols = Math.max(20, cols);
  const safeRows = Math.max(15, rows);
  const splitCol = clamp(Math.round(safeCols * 0.62), 12, safeCols - 7);
  const splitRow = clamp(Math.round(safeRows * 0.63), 8, safeRows - 5);
  const focusMax = splitCol - 1;
  const planningMaxRow = Math.max(5, Math.round(safeRows * 0.35));

  return [
    {
      id: "planning",
      label: "Planning studio",
      purpose: "Thinking, reading, and shaping the work",
      minCol: 2,
      maxCol: focusMax,
      minRow: 2,
      maxRow: planningMaxRow,
      anchor: { col: Math.round(focusMax * 0.48), row: Math.round(planningMaxRow * 0.58) },
      color: "#C084FC",
    },
    {
      id: "focus",
      label: "Focus desks",
      purpose: "Coding, debugging, and concentrated execution",
      minCol: 2,
      maxCol: focusMax,
      minRow: planningMaxRow + 1,
      maxRow: safeRows - 3,
      anchor: { col: Math.round(focusMax * 0.48), row: Math.round(safeRows * 0.68) },
      color: "#60A5FA",
    },
    {
      id: "collaboration",
      label: "Collaboration table",
      purpose: "Review, testing, handoffs, and approvals",
      minCol: splitCol + 1,
      maxCol: safeCols - 3,
      minRow: 2,
      maxRow: splitRow - 1,
      anchor: { col: Math.round((splitCol + safeCols) / 2), row: Math.round(splitRow * 0.5) },
      color: "#34D399",
    },
    {
      id: "lounge",
      label: "Lounge",
      purpose: "Idle agents, completed work, and quiet recovery",
      minCol: splitCol + 1,
      maxCol: safeCols - 3,
      minRow: splitRow + 1,
      maxRow: safeRows - 3,
      anchor: { col: Math.round((splitCol + safeCols) / 2), row: Math.round((splitRow + safeRows) / 2) },
      color: "#FBBF24",
    },
  ];
}

export function resolveAgentZone(state: string, paused = false): CoworkingZoneId {
  if (paused) return "lounge";
  return STATE_ZONE[state] ?? "focus";
}

function positionsForZone(zone: CoworkingZone, count: number): TileCoord[] {
  if (count === 0) return [];
  const width = Math.max(1, zone.maxCol - zone.minCol);
  const height = Math.max(1, zone.maxRow - zone.minRow);
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const xRatio = columns === 1 ? 0.5 : (column + 1) / (columns + 1);
    const yRatio = rows === 1 ? 0.5 : (row + 1) / (rows + 1);
    return {
      col: clamp(Math.round(zone.minCol + width * xRatio), zone.minCol, zone.maxCol),
      row: clamp(Math.round(zone.minRow + height * yRatio), zone.minRow, zone.maxRow),
    };
  });
}

export function assignCoworkingTiles(
  agents: CoworkingAgent[],
  cols: number,
  rows: number,
): { tiles: Record<string, TileCoord>; zones: Record<string, CoworkingZoneId> } {
  const zoneDefinitions = buildCoworkingZones(cols, rows);
  const byZone = new Map<CoworkingZoneId, CoworkingAgent[]>();
  zoneDefinitions.forEach((zone) => byZone.set(zone.id, []));

  agents.forEach((agent) => {
    const zone = resolveAgentZone(agent.state, agent.paused);
    byZone.get(zone)!.push(agent);
  });

  const tiles: Record<string, TileCoord> = {};
  const zones: Record<string, CoworkingZoneId> = {};
  zoneDefinitions.forEach((zone) => {
    const occupants = byZone.get(zone.id) ?? [];
    const positions = positionsForZone(zone, occupants.length);
    occupants.forEach((agent, index) => {
      tiles[agent.id] = positions[index];
      zones[agent.id] = zone.id;
    });
  });

  return { tiles, zones };
}

export function summarizeZoneActivity(agents: CoworkingAgent[]): Record<CoworkingZoneId, number> {
  const summary: Record<CoworkingZoneId, number> = {
    focus: 0,
    planning: 0,
    collaboration: 0,
    lounge: 0,
  };
  agents.forEach((agent) => {
    summary[resolveAgentZone(agent.state, agent.paused)] += 1;
  });
  return summary;
}
