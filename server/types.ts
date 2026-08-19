export type AgentState = "idle" | "thinking" | "reading" | "coding" | "testing" | "reviewing" | "debugging" | "permission-waiting" | "done";

export interface Agent {
  id: string;
  name: string;
  state: AgentState;
  task: string;
  paused: boolean;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  lastAction: string;
  logs: string[];
  x: number;
  y: number;
}

export interface WorkflowEvent {
  type: string;
  timestamp: number;
  nodeId?: string;
  detail?: string;
  senderAgentId?: string;
  recipientAgentId?: string;
}

export type ClientMessage =
  | { type: "pause"; agentId: string }
  | { type: "resume"; agentId: string };
