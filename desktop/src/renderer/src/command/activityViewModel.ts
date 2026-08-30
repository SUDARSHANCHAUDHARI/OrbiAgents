import type { ActivityEvent } from "../../../shared/contracts";

export interface ActivityFilters { agentId: string; source: string; state: string }

export function filterActivity(events: ActivityEvent[], filters: ActivityFilters): ActivityEvent[] {
  return events.filter((event) =>
    (!filters.agentId || event.agentId === filters.agentId)
    && (!filters.source || event.source === filters.source)
    && (!filters.state || (event.state ?? "unclassified") === filters.state),
  ).slice().reverse();
}

export function activityOverview(events: ActivityEvent[]): string {
  if (!events.length) return "No runtime signals in this desktop session";
  const agents = new Set(events.map((event) => event.agentId)).size;
  const provider = events.filter((event) => event.type === "provider-activity").length;
  const attention = events.filter((event) => event.state === "failed" || event.state === "permission-waiting").length;
  return `${events.length} signals · ${agents} agent${agents === 1 ? "" : "s"} · ${provider} provider events${attention ? ` · ${attention} need attention` : ""}`;
}
