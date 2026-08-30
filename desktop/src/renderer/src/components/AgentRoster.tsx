import type { AgentSession } from "../../../shared/contracts";
import { PixelPanel } from "./ui/PixelPanel";
import { StatusBadge } from "./ui/StatusBadge";

interface AgentRosterProps {
  agents: AgentSession[];
  selectedId: string | null;
  onSelect(id: string): void;
}

export function AgentRoster({ agents, selectedId, onSelect }: AgentRosterProps) {
  return (
    <aside className="roster" aria-label="Agent roster">
      <PixelPanel title="Agent fleet" eyebrow={`${agents.length} registered`} className="roster-panel">
        {agents.length === 0 ? <p className="empty">Launch your first agent to populate the command deck.</p> : null}
        {agents.map((agent) => (
          <button
            className={`agent-card ${selectedId === agent.id ? "selected" : ""}`}
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            type="button"
          >
            <span className="agent-card__identity">
              <strong>{agent.name}</strong>
              <small>{agent.runtimeId} · {agent.workspace.status} workspace</small>
            </span>
            <StatusBadge status={agent.status} />
          </button>
        ))}
      </PixelPanel>
    </aside>
  );
}
