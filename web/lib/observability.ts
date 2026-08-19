import type { WorkflowEvent } from "./types";

const LABELS: Record<string, string> = {
  "workflow-started": "Orbi-Prime started the workflow",
  "node-ready": "Agent is ready",
  "node-started": "Agent started work",
  "node-retrying": "Orbi-Prime scheduled a retry",
  "node-completed": "Agent completed work",
  "node-failed": "Agent failed",
  "circuit-opened": "Circuit breaker stopped execution",
  "workflow-completed": "Workflow completed",
  "mailbox-message": "Agent message delivered",
};

export function describeWorkflowEvent(event: WorkflowEvent): string {
  const base = LABELS[event.type] ?? event.type.replace(/-/g, " ");
  const subject = event.nodeId ? ` · ${event.nodeId}` : "";
  const detail = event.detail ? ` · ${event.detail}` : "";
  return `${base}${subject}${detail}`;
}

export function isSupervisorActive(events: WorkflowEvent[]): boolean {
  let active = false;
  for (const event of events) {
    if (event.type === "workflow-started") active = true;
    if (event.type === "workflow-completed" || event.type === "circuit-opened") active = false;
  }
  return active;
}
