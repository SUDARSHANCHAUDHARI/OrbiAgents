import type { ActivityEvent, AgentSession } from "../../../shared/contracts";

export interface RuntimeUsageSnapshot {
  totalSignals: number;
  providerSignals: number;
  activeMinutes: number;
  byState: Array<{ state: string; count: number }>;
  byAgent: Array<{ agentId: string; name: string; count: number }>;
}

export function runtimeUsage(events: ActivityEvent[], agents: AgentSession[], now = Date.now()): RuntimeUsageSnapshot {
  const provider = events.filter((event) => event.type === "provider-activity");
  const byState = counts(provider.map((event) => event.state ?? "unclassified"), "state");
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const byAgent = counts(provider.map((event) => event.agentId), "agentId").map((entry) => ({ ...entry, name: names.get(entry.agentId) ?? entry.agentId }));
  const activeMinutes = agents.reduce((total, agent) => total + Math.max(0, (agent.exitedAt ?? now) - agent.startedAt), 0) / 60_000;
  return { totalSignals: events.length, providerSignals: provider.length, activeMinutes: Math.round(activeMinutes * 10) / 10, byState, byAgent };
}

function counts<K extends "state" | "agentId">(values: string[], key: K): Array<Record<K, string> & { count: number }> {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals].map(([value, count]) => ({ [key]: value, count }) as Record<K, string> & { count: number }).sort((left, right) => right.count - left.count || left[key].localeCompare(right[key]));
}
