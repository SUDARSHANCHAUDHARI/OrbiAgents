export type AgentState =
  | "idle"
  | "thinking"
  | "reading"
  | "coding"
  | "testing"
  | "reviewing"
  | "debugging"
  | "permission-waiting"
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
  events?: WorkflowEvent[];
  totalCostUsd?: number;
  provider?: Provider;
}

export interface WorkflowEvent {
  type: string;
  timestamp: number;
  nodeId?: string;
  detail?: string;
  senderAgentId?: string;
  recipientAgentId?: string;
}

export interface SessionMeta {
  id: string;
  task: string;
  createdAt: number;
  totalCostUsd?: number;
  provider?: Provider;
}

export type Provider = "anthropic" | "openai" | "gemini";
export type RuntimeId = "provider-api" | "codex-cli" | "claude-cli";

export interface PreservedWorkspace {
  id: string;
  runId: string;
  nodeId: string;
  path: string;
  createdAt: number;
}

export interface WorkspaceChanges {
  status: string;
  diffStat: string;
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

export interface WorkflowStepResult {
  nodeId: string;
  type: WorkflowNodeType;
  label: string;
  output: string;
  workspacePath?: string;
  workspaceDisposition?: "removed" | "preserved";
}
