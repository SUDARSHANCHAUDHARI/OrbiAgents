export type AgentState = "idle" | "thinking" | "coding" | "done";

export interface Agent {
  id: string;
  name: string;
  state: AgentState;
  task: string;
  paused: boolean;
  tokensUsed: number;
  lastAction: string;
  logs: string[];
  x: number;
  y: number;
}

export type ClientMessage =
  | { type: "pause"; agentId: string }
  | { type: "resume"; agentId: string };
