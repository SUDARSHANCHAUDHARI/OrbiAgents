import type { AgentActivityState, AgentSession, HiveSnapshot } from "../../../shared/contracts";

export type OfficeZoneId = "planning" | "focus" | "collaboration" | "lounge";
export interface OfficeAgent { id: string; name: string; state: AgentActivityState; zone: OfficeZoneId; x: number; y: number; color: number; }
export interface OfficeLink { id: string; fromAgentId: string; toAgentId: string | "orbi-prime"; kind: "task" | "message"; }

export const OFFICE_ZONES = [
  { id: "planning", label: "Planning Studio", x: 0.04, y: 0.08, width: 0.55, height: 0.34, color: 0xc084fc },
  { id: "focus", label: "Focus Desks", x: 0.04, y: 0.49, width: 0.55, height: 0.43, color: 0x60a5fa },
  { id: "collaboration", label: "Collaboration", x: 0.64, y: 0.08, width: 0.32, height: 0.48, color: 0x34d399 },
  { id: "lounge", label: "Lounge", x: 0.64, y: 0.63, width: 0.32, height: 0.29, color: 0xfbbf24 },
] as const;

const STATE_ZONE: Record<AgentActivityState, OfficeZoneId> = { idle: "lounge", thinking: "planning", reading: "planning", coding: "focus", "permission-waiting": "collaboration", done: "lounge", failed: "collaboration" };
const COLORS = [0x67e8f9, 0xa78bfa, 0x34d399, 0xfbbf24, 0xfb7185];

export function buildOfficeAgents(agents: AgentSession[], states: Record<string, AgentActivityState | undefined>): OfficeAgent[] {
  const grouped = new Map<OfficeZoneId, AgentSession[]>();
  OFFICE_ZONES.forEach((zone) => grouped.set(zone.id, []));
  agents.forEach((agent) => grouped.get(STATE_ZONE[states[agent.id] ?? fallbackState(agent)])!.push(agent));
  const result: OfficeAgent[] = [];
  OFFICE_ZONES.forEach((zone) => (grouped.get(zone.id) ?? []).forEach((agent, index, occupants) => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(occupants.length)));
    const col = index % columns;
    const row = Math.floor(index / columns);
    result.push({ id: agent.id, name: agent.name, state: states[agent.id] ?? fallbackState(agent), zone: zone.id, x: zone.x + zone.width * ((col + 1) / (columns + 1)), y: zone.y + zone.height * ((row + 1) / (Math.ceil(occupants.length / columns) + 1)), color: COLORS[result.length % COLORS.length] });
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
