import { useMemo, useState } from "react";
import type { ActivityEvent, AgentSession } from "../../../shared/contracts";
import { activityOverview, filterActivity } from "../command/activityViewModel";

export function ActivityOperationsPanel({ events, agents }: { events: ActivityEvent[]; agents: AgentSession[] }) {
  const [agentId, setAgentId] = useState("");
  const [source, setSource] = useState("");
  const [state, setState] = useState("");
  const visible = filterActivity(events, { agentId, source, state });
  const names = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const sources = [...new Set(events.map((event) => event.source))].sort();
  const states = [...new Set(events.map((event) => event.state ?? "unclassified"))].sort();
  const filtered = Boolean(agentId || source || state);
  function clear() { setAgentId(""); setSource(""); setState(""); }

  return <section className="command-panel activity-operations" aria-label="Normalized runtime activity">
    <div className="section-title"><span>Normalized runtime activity</span>{filtered ? <button type="button" onClick={clear}>Clear filters</button> : null}</div>
    <p className="empty" aria-live="polite">{activityOverview(events)} · showing {visible.length}</p>
    <div className="activity-filters">
      <select aria-label="Filter activity by agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">All agents</option>{[...new Set(events.map((event) => event.agentId))].sort().map((id) => <option key={id} value={id}>{names.get(id) ?? id}</option>)}</select>
      <select aria-label="Filter activity by source" value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option>{sources.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Filter activity by state" value={state} onChange={(event) => setState(event.target.value)}><option value="">All states</option>{states.map((value) => <option key={value} value={value}>{value}</option>)}</select>
    </div>
    {visible.length ? <ul>{visible.map((event) => <li key={event.id}><strong>{names.get(event.agentId) ?? event.agentId} · {event.state ?? event.type.replaceAll("-", " ")}</strong><small>{event.source} · {new Date(event.timestamp).toLocaleString()}</small><span>{event.summary}</span></li>)}</ul> : <p className="empty">No signals match these filters.</p>}
  </section>;
}
