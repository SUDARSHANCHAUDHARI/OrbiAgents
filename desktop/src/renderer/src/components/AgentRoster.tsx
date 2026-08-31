import type { AgentSession } from "../../../shared/contracts";
import { PixelPanel } from "./ui/PixelPanel";
import { StatusBadge } from "./ui/StatusBadge";
import { useI18n } from "../i18n";

interface AgentRosterProps {
  agents: AgentSession[];
  selectedId: string | null;
  onSelect(id: string): void;
}

export function AgentRoster({ agents, selectedId, onSelect }: AgentRosterProps) {
  const { t } = useI18n();
  return (
    <aside className="roster" aria-label={t("agentRoster")}>
      <PixelPanel title={t("agentFleet")} eyebrow={`${agents.length} ${t("registered")}`} className="roster-panel">
        {agents.length === 0 ? <p className="empty">{t("emptyFleet")}</p> : null}
        {agents.map((agent) => (
          <button
            className={`agent-card ${selectedId === agent.id ? "selected" : ""}`}
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            type="button"
          >
            <span className="agent-card__identity">
              <strong>{agent.name}</strong>
              <small>{agent.profile?.role ?? agent.runtimeId} · {agent.workspace.status} {t("workspaceSuffix")}</small>
            </span>
            <StatusBadge status={agent.status} />
          </button>
        ))}
      </PixelPanel>
    </aside>
  );
}
