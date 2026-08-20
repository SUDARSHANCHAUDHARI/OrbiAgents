import type { WorkflowEvent } from "./types";

const LABELS: Record<string, string> = {
  "workflow-started": "Orbi-Prime started the workflow",
  "node-ready": "Agent is ready",
  "node-started": "Agent started work",
  "node-retrying": "Orbi-Prime scheduled a retry",
  "recovery-selected": "Orbi-Prime selected recovery",
  "node-completed": "Agent completed work",
  "node-failed": "Agent failed",
  "circuit-opened": "Circuit breaker stopped execution",
  "workflow-failed": "Workflow failed",
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
    if (["workflow-completed", "workflow-failed", "circuit-opened"].includes(event.type)) active = false;
  }
  return active;
}

export interface MessageFlightPoint { x: number; y: number }

export function buildMessageFlightPath(
  event: WorkflowEvent,
  positions: Record<string, MessageFlightPoint>
): string | null {
  const from = event.senderAgentId ? positions[event.senderAgentId] : undefined;
  const to = event.recipientAgentId ? positions[event.recipientAgentId] : undefined;
  if (event.type !== "mailbox-message" || !from || !to) return null;
  return `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 60} ${to.x} ${to.y}`;
}
