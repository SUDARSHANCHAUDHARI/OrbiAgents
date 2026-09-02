import { useMemo, useState } from "react";
import type { ActivityEvent, AgentSession } from "../../../shared/contracts";
import { activityOverview, eventOffset, filterActivity, runtimeBudget } from "../command/activityViewModel";
import { useI18n } from "../i18n";

export function ActivityOperationsPanel({ events, agents }: { events: ActivityEvent[]; agents: AgentSession[] }) {
  const { t } = useI18n();
  const [agentId, setAgentId] = useState("");
  const [source, setSource] = useState("");
  const [state, setState] = useState("");
  const visible = filterActivity(events, { agentId, source, state });
  const names = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents]);
  const sources = [...new Set(events.map((event) => event.source))].sort();
  const states = [...new Set(events.map((event) => event.state ?? "unclassified"))].sort();
  const filtered = Boolean(agentId || source || state);
  const overview = activityOverview(events);
  function clear() { setAgentId(""); setSource(""); setState(""); }

  return <section className="command-panel activity-operations" aria-label={t("normalizedActivity")}>
    <div className="section-title"><span>{t("normalizedActivity")}</span>{filtered ? <button type="button" onClick={clear}>{t("clearFilters")}</button> : null}</div>
    <p className="empty" aria-live="polite">{overview.signals ? `${overview.signals} ${t("signals")} · ${overview.agents} ${t("agentsCount")} · ${overview.providerEvents} ${t("providerEvents")}${overview.attention ? ` · ${overview.attention} ${t("needAttention")}` : ""}` : t("noSessionSignals")} · {t("showing")} {visible.length}</p>
    <ul>{agents.filter((agent) => agent.profile).map((agent) => { const budget = runtimeBudget(agent.startedAt, agent.profile!.budgetMinutes); return <li key={`budget-${agent.id}`}><strong>{agent.name} · {t("runtimeBudget")}</strong><small>{budget.elapsedMinutes.toFixed(1)} / {agent.profile!.budgetMinutes} {t("minutesLabel")} · {budget.percent}%</small><progress max={100} value={budget.percent} aria-label={`${agent.name} ${t("runtimeBudget")}`} /></li>; })}</ul>
    <div className="activity-filters">
      <select aria-label={t("filterActivityAgent")} value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">{t("allAgents")}</option>{[...new Set(events.map((event) => event.agentId))].sort().map((id) => <option key={id} value={id}>{names.get(id) ?? id}</option>)}</select>
      <select aria-label={t("filterActivitySource")} value={source} onChange={(event) => setSource(event.target.value)}><option value="">{t("allSources")}</option>{sources.map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label={t("filterActivityState")} value={state} onChange={(event) => setState(event.target.value)}><option value="">{t("allStates")}</option>{states.map((value) => <option key={value} value={value}>{value}</option>)}</select>
    </div>
    {visible.length ? <ul>{visible.map((event) => <li key={event.id}><strong>{names.get(event.agentId) ?? event.agentId} · {event.state ?? event.type.replaceAll("-", " ")}</strong><small>+{(eventOffset(events, event) / 1000).toFixed(1)}s · {event.source} · {new Date(event.timestamp).toLocaleString()}</small><span>{event.summary}</span></li>)}</ul> : <p className="empty">{t("noSignalMatches")}</p>}
  </section>;
}
