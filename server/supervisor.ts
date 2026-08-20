export type SupervisorEventType =
  | "workflow-started"
  | "node-ready"
  | "node-started"
  | "node-retrying"
  | "recovery-selected"
  | "node-completed"
  | "node-failed"
  | "circuit-opened"
  | "workflow-failed"
  | "workflow-completed";

export interface SupervisorEvent {
  type: SupervisorEventType;
  timestamp: number;
  nodeId?: string;
  detail?: string;
}

export type SupervisorObserver = (event: SupervisorEvent) => void;

export class OrbiPrimeSupervisor {
  constructor(private readonly observe: SupervisorObserver = () => {}) {}

  report(type: SupervisorEventType, input: Omit<SupervisorEvent, "type" | "timestamp"> = {}): void {
    this.observe({ type, timestamp: Date.now(), ...input });
  }

  selectRecovery(nodeId: string, error: unknown, attempt: number): "retry" | "stop" {
    const name = error instanceof Error ? error.name : "Error";
    const action = attempt === 0 && name !== "NodeTimeoutError" && name !== "AbortError" ? "retry" : "stop";
    this.report("recovery-selected", { nodeId, detail: `${action}: ${error instanceof Error ? error.message : String(error)}` });
    return action;
  }
}
