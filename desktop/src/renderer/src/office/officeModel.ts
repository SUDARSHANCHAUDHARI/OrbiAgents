import type { AgentActivityState, AgentSession, HiveSnapshot } from "../../../shared/contracts";
import { createOrbitalWorld, isWalkable, stationForState, type OrbitalStationId, type OrbitalWorld } from "./orbitalWorld";

export type OfficeZoneId = "planning" | "focus" | "collaboration" | "lounge";
export interface OfficeAgent { id: string; name: string; state: AgentActivityState; zone: OfficeZoneId; stationId: OrbitalStationId; column: number; row: number; color: number; }
export interface OfficeLink { id: string; fromAgentId: string; toAgentId: string | "orbi-prime"; kind: "task" | "message"; }

const STATE_ZONE: Record<AgentActivityState, OfficeZoneId> = { idle: "lounge", thinking: "planning", reading: "planning", coding: "focus", "permission-waiting": "collaboration", done: "lounge", failed: "collaboration" };
const COLORS = [0x67e8f9, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185];
const APPEARANCE_COLORS = { cyan: 0x67e8f9, violet: 0xa78bfa, green: 0x34d399, gold: 0xfbbf24, rose: 0xfb7185 } as const;

export function buildOfficeAgents(agents: AgentSession[], states: Record<string, AgentActivityState | undefined>, world: OrbitalWorld = createOrbitalWorld()): OfficeAgent[] {
  const grouped = new Map<OrbitalStationId, AgentSession[]>();
  world.stations.forEach((station) => grouped.set(station.id, []));
  agents.forEach((agent) => grouped.get(stationForState(states[agent.id] ?? fallbackState(agent)))!.push(agent));
  const result: OfficeAgent[] = [];
  const occupied = new Set<string>();
  world.stations.forEach((station) => (grouped.get(station.id) ?? []).forEach((agent) => {
    const state = states[agent.id] ?? fallbackState(agent);
    const destination = closestAvailableTile(world, station.column, station.row, occupied);
    occupied.add(`${destination.column}:${destination.row}`);
    result.push({ id: agent.id, name: agent.name, state, zone: STATE_ZONE[state], stationId: station.id, column: destination.column, row: destination.row, color: agent.profile ? APPEARANCE_COLORS[agent.profile.appearance] : COLORS[result.length % COLORS.length] });
  }));
  return result;
}

export function buildOfficeLinks(hive: HiveSnapshot | null, visibleAgentIds: Set<string>): OfficeLink[] {
  if (!hive) return [];
  const links: OfficeLink[] = [];
  for (const task of hive.tasks) {
    if (task.assigneeAgentId && visibleAgentIds.has(task.assigneeAgentId) && ["assigned", "in-progress", "blocked"].includes(task.status)) {
      links.push({ id: `task:${task.id}`, fromAgentId: task.assigneeAgentId, toAgentId: "orbi-prime", kind: "task" });
    }
  }
  for (const message of hive.primeInbox) {
    if (message.status !== "delivered" || !visibleAgentIds.has(message.senderAgentId)) continue;
    links.push({ id: `message:${message.id}`, fromAgentId: message.senderAgentId, toAgentId: "orbi-prime", kind: "message" });
  }
  return links;
}

function fallbackState(agent: AgentSession): AgentActivityState {
  if (agent.status === "failed") return "failed";
  if (agent.status === "exited") return "done";
  return "idle";
}

function closestAvailableTile(world: OrbitalWorld, column: number, row: number, occupied: Set<string>): { column: number; row: number } {
  const candidates = world.tiles
    .filter((tile) => isWalkable(tile) && !occupied.has(`${tile.column}:${tile.row}`))
    .sort((left, right) => Math.abs(left.column - column) + Math.abs(left.row - row) - Math.abs(right.column - column) - Math.abs(right.row - row) || left.row - right.row || left.column - right.column);
  return candidates[0] ? { column: candidates[0].column, row: candidates[0].row } : { column, row };
}
