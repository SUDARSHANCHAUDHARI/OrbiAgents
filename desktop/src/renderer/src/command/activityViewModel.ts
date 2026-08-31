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
