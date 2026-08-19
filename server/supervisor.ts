export type SupervisorEventType =
  | "workflow-started"
  | "node-ready"
  | "node-started"
  | "node-retrying"
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
}
