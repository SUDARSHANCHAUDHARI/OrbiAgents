import type { AgentStatus } from "../../../../shared/contracts";

export function StatusBadge({ status, label = status }: { status: AgentStatus; label?: string }) {
  return <span className={`status-badge status-badge--${status}`}><i aria-hidden="true" />{label}</span>;
}
