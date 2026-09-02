import type { ActivityEvent } from "../../../shared/contracts";

export interface ActivityFilters { agentId: string; source: string; state: string }

export function filterActivity(events: ActivityEvent[], filters: ActivityFilters): ActivityEvent[] {
  return events.filter((event) =>
    (!filters.agentId || event.agentId === filters.agentId)
    && (!filters.source || event.source === filters.source)
    && (!filters.state || (event.state ?? "unclassified") === filters.state),
  ).slice().reverse();
}

export interface ActivityOverview { signals: number; agents: number; providerEvents: number; attention: number; }
export function activityOverview(events: ActivityEvent[]): ActivityOverview { return { signals: events.length, agents: new Set(events.map((event) => event.agentId)).size, providerEvents: events.filter((event) => event.type === "provider-activity").length, attention: events.filter((event) => event.state === "failed" || event.state === "permission-waiting").length }; }

export function eventOffset(events: ActivityEvent[], event: ActivityEvent): number { const startedAt = events.filter((candidate) => candidate.agentId === event.agentId).reduce((earliest, candidate) => Math.min(earliest, candidate.timestamp), event.timestamp); return Math.max(0, event.timestamp - startedAt); }
export function runtimeBudget(startedAt: number, budgetMinutes: number, now = Date.now()): { elapsedMinutes: number; percent: number } { const elapsedMinutes = Math.max(0, (now - startedAt) / 60_000); return { elapsedMinutes, percent: Math.min(100, Math.round((elapsedMinutes / budgetMinutes) * 100)) }; }
