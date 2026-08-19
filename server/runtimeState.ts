import { WebSocket } from "ws";
import { Agent } from "./types";

export interface UserRuntime {
  agents: Agent[];
  workflowRunning: boolean;
  cancelRequested: boolean;
  activeSessionId: string | null;
  workflowAbortController: AbortController | null;
  sockets: Set<WebSocket>;
  lastTouchedAt: number;
}

export class WorkflowCancelledError extends Error {
  constructor(message: string = "Workflow cancelled") {
    super(message);
    this.name = "WorkflowCancelledError";
  }
}

export const RUNTIME_TTL_MS = 10 * 60 * 1000;

export function createUserRuntime(makeAgents: () => Agent[]): UserRuntime {
  return {
    agents: makeAgents(),
    workflowRunning: false,
    cancelRequested: false,
    activeSessionId: null,
    workflowAbortController: null,
    sockets: new Set(),
    lastTouchedAt: Date.now(),
  };
}

export function touchRuntime(runtime: UserRuntime): void {
  runtime.lastTouchedAt = Date.now();
}

export function getOrCreateRuntime(
  runtimes: Map<string, UserRuntime>,
  userId: string,
  makeAgents: () => Agent[]
): UserRuntime {
  let runtime = runtimes.get(userId);
  if (!runtime) {
    runtime = createUserRuntime(makeAgents);
    runtimes.set(userId, runtime);
  }
  touchRuntime(runtime);
  return runtime;
}

export function resetRuntimeAgents(runtime: UserRuntime): void {
  runtime.agents = runtime.agents.map((agent) => ({
    ...agent,
    state: "idle",
    task: "Ready",
    paused: false,
    lastAction: "Waiting for task",
  }));
  runtime.cancelRequested = false;
}

export function setAgentPaused(runtime: UserRuntime, agentId: string, paused: boolean): void {
  runtime.agents = runtime.agents.map((agent) =>
    agent.id === agentId ? { ...agent, paused } : agent
  );
}

let _subAgentSeq = 0;
const SUB_AGENT_NAMES = ["Sub-A", "Sub-B", "Sub-C", "Sub-D", "Sub-E", "Sub-F"];

export function spawnSubAgent(runtime: UserRuntime, parentId: string): Agent {
  const seq = ++_subAgentSeq;
  const id = `sub-${parentId}-${seq}`;
  const name = SUB_AGENT_NAMES[seq % SUB_AGENT_NAMES.length];
  const sub: Agent = {
    id,
    name,
    state: "thinking",
    task: "Delegated sub-task",
    paused: false,
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    lastAction: "Starting",
    logs: [],
    x: 0,
    y: 0,
  };
  runtime.agents = [...runtime.agents, sub];
  return sub;
}

export function despawnSubAgent(runtime: UserRuntime, subId: string): void {
  runtime.agents = runtime.agents.filter(a => a.id !== subId);
}

export function requestRuntimeCancel(runtime: UserRuntime): void {
  runtime.cancelRequested = true;
  runtime.workflowAbortController?.abort(new WorkflowCancelledError());
  runtime.agents = runtime.agents.map((agent) =>
    agent.state === "idle" || agent.state === "done"
      ? agent
      : {
          ...agent,
          task: "Stopping workflow…",
          lastAction: "Stop requested",
        }
  );
}

export function ensureRuntimeActive(runtime: UserRuntime): void {
  if (runtime.cancelRequested) {
    throw new WorkflowCancelledError();
  }
}

export function cleanupRuntimeStore(
  runtimes: Map<string, UserRuntime>,
  now: number = Date.now(),
  ttlMs: number = RUNTIME_TTL_MS
): void {
  runtimes.forEach((runtime, userId) => {
    const isIdle = !runtime.workflowRunning && runtime.activeSessionId == null;
    const hasNoSockets = runtime.sockets.size === 0;
    const expired = now - runtime.lastTouchedAt > ttlMs;
    if (isIdle && hasNoSockets && expired) {
      runtimes.delete(userId);
    }
  });
}
