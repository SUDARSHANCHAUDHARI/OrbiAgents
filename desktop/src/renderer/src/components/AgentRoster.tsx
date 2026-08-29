import type { AgentSession } from "../../../shared/contracts";

interface AgentRosterProps {
  agents: AgentSession[];
  selectedId: string | null;
  onSelect(id: string): void;
}

export function AgentRoster({ agents, selectedId, onSelect }: AgentRosterProps) {
  return (
    <aside className="roster" aria-label="Agent roster">
      <div className="section-title">Agent floor</div>
      {agents.length === 0 ? <p className="empty">No agents yet.</p> : null}
      {agents.map((agent) => (
        <button
          className={`agent-card ${selectedId === agent.id ? "selected" : ""}`}
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          type="button"
        >
          <span className={`status-dot ${agent.status}`} aria-hidden="true" />
          <span>
            <strong>{agent.name}</strong>
            <small>{agent.runtimeId} · {agent.status}</small>
            <small>workspace · {agent.workspace.status}</small>
          </span>
        </button>
      ))}
    </aside>
  );
}
