export type AgentState = "idle" | "thinking" | "coding" | "done";

export interface Agent {
  id: string;
  name: string;
  state: AgentState;
  x: number;
  y: number;
}
