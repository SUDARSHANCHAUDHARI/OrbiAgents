import type { ActivityEvent, AgentSession } from "../../../shared/contracts";

export interface RuntimeUsageSnapshot {
  totalSignals: number;
  providerSignals: number;
  activeMinutes: number;
  reportedInputTokens: number;
  reportedOutputTokens: number;
  reportedCachedInputTokens: number;
  reportedCostUsd: number;
  byState: Array<{ state: string; count: number }>;
  byAgent: Array<{ agentId: string; name: string; count: number }>;
}

export function runtimeUsage(events: ActivityEvent[], agents: AgentSession[], now = Date.now()): RuntimeUsageSnapshot {
  const provider = events.filter((event) => event.type === "provider-activity");
  const byState = counts(provider.map((event) => event.state ?? "unclassified"), "state");
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const byAgent = counts(provider.map((event) => event.agentId), "agentId").map((entry) => ({ ...entry, name: names.get(entry.agentId) ?? entry.agentId }));
  const activeMinutes = agents.reduce((total, agent) => total + Math.max(0, (agent.exitedAt ?? now) - agent.startedAt), 0) / 60_000;
  const reported = aggregateProviderUsage(provider);
  return { totalSignals: events.length, providerSignals: provider.length, activeMinutes: Math.round(activeMinutes * 10) / 10, ...reported, byState, byAgent };
}

function aggregateProviderUsage(events: ActivityEvent[]): Pick<RuntimeUsageSnapshot, "reportedInputTokens" | "reportedOutputTokens" | "reportedCachedInputTokens" | "reportedCostUsd"> {
  const byAgent = new Map<string, ActivityEvent[]>();
  for (const event of events) if (event.usage) byAgent.set(event.agentId, [...(byAgent.get(event.agentId) ?? []), event]);
  let reportedInputTokens = 0; let reportedOutputTokens = 0; let reportedCachedInputTokens = 0; let reportedCostUsd = 0;
  for (const agentEvents of byAgent.values()) {
    const sessionTotal = agentEvents.filter((event) => event.usage?.scope === "session-total").at(-1)?.usage;
    const usage = sessionTotal ? [sessionTotal] : agentEvents.flatMap((event) => event.usage ? [event.usage] : []);
    for (const report of usage) {
      reportedInputTokens += report.inputTokens;
      reportedOutputTokens += report.outputTokens;
      reportedCachedInputTokens += report.cachedInputTokens ?? 0;
      reportedCostUsd += report.costUsd ?? 0;
    }
  }
  return { reportedInputTokens, reportedOutputTokens, reportedCachedInputTokens, reportedCostUsd: Math.round(reportedCostUsd * 1_000_000) / 1_000_000 };
}

function counts<K extends "state" | "agentId">(values: string[], key: K): Array<Record<K, string> & { count: number }> {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value, (totals.get(value) ?? 0) + 1);
  return [...totals].map(([value, count]) => ({ [key]: value, count }) as Record<K, string> & { count: number }).sort((left, right) => right.count - left.count || left[key].localeCompare(right[key]));
}
