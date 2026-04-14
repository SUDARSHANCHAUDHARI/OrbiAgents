export type AgentState =
  | "idle"
  | "thinking"
  | "coding"
  | "testing"
  | "reviewing"
  | "debugging"
  | "done";

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

export type ClientMessage =
  | { type: "pause"; agentId: string }
  | { type: "resume"; agentId: string };

export interface SessionFrame {
  timestamp: number;
  agents: Agent[];
}

export interface Session {
  id: string;
  task: string;
  createdAt: number;
  frames: SessionFrame[];
}

export interface SessionMeta {
  id: string;
  task: string;
  createdAt: number;
}

// ── Workflow builder ───────────────────────────────────────────────
export type WorkflowNodeType = "planner" | "coder" | "tester" | "reviewer" | "debugger";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
