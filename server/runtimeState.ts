import { WebSocket } from "ws";
import { Agent } from "./types";

export interface UserRuntime {
  agents: Agent[];
  workflowRunning: boolean;
  activeSessionId: string | null;
  sockets: Set<WebSocket>;
  lastTouchedAt: number;
}

export const RUNTIME_TTL_MS = 10 * 60 * 1000;

export function createUserRuntime(makeAgents: () => Agent[]): UserRuntime {
  return {
    agents: makeAgents(),
    workflowRunning: false,
    activeSessionId: null,
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
  }));
}

export function setAgentPaused(runtime: UserRuntime, agentId: string, paused: boolean): void {
  runtime.agents = runtime.agents.map((agent) =>
    agent.id === agentId ? { ...agent, paused } : agent
  );
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
