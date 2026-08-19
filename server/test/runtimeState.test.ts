import test from "node:test";
import assert from "node:assert/strict";
import { Agent } from "../types";
import {
  cleanupRuntimeStore,
  createUserRuntime,
  ensureRuntimeActive,
  getOrCreateRuntime,
  requestRuntimeCancel,
  resetRuntimeAgents,
  setAgentPaused,
  WorkflowCancelledError,
} from "../runtimeState";

function makeAgents(): Agent[] {
  return [
    {
      id: "1",
      name: "Orbi-Alpha",
      state: "thinking",
      task: "Working",
      paused: false,
      tokensUsed: 10,
      inputTokens: 5,
      outputTokens: 5,
      costUsd: 0.01,
      lastAction: "Started",
      logs: ["init"],
      x: 0,
      y: 0,
    },
  ];
}

test("getOrCreateRuntime isolates state per user", () => {
  const runtimes = new Map();
  const alpha = getOrCreateRuntime(runtimes, "user-a", makeAgents);
  const beta = getOrCreateRuntime(runtimes, "user-b", makeAgents);

  setAgentPaused(alpha, "1", true);

  assert.equal(alpha.agents[0]?.paused, true);
  assert.equal(beta.agents[0]?.paused, false);
});

test("cleanupRuntimeStore removes only idle expired runtimes without sockets", () => {
  const runtimes = new Map();
  const expiredIdle = createUserRuntime(makeAgents);
  expiredIdle.lastTouchedAt = 0;

  const active = createUserRuntime(makeAgents);
  active.workflowRunning = true;
  active.lastTouchedAt = 0;

  const connected = createUserRuntime(makeAgents);
  connected.lastTouchedAt = 0;
  connected.sockets.add({} as never);

  runtimes.set("expired", expiredIdle);
  runtimes.set("active", active);
  runtimes.set("connected", connected);

  cleanupRuntimeStore(runtimes, 11 * 60 * 1000, 10 * 60 * 1000);

  assert.equal(runtimes.has("expired"), false);
  assert.equal(runtimes.has("active"), true);
  assert.equal(runtimes.has("connected"), true);
});

test("resetRuntimeAgents restores agents to idle-ready state", () => {
  const runtime = createUserRuntime(makeAgents);

  resetRuntimeAgents(runtime);

  assert.equal(runtime.agents[0]?.state, "idle");
  assert.equal(runtime.agents[0]?.task, "Ready");
  assert.equal(runtime.agents[0]?.paused, false);
});

test("requestRuntimeCancel marks running agents and blocks further progress", () => {
  const runtime = createUserRuntime(makeAgents);

  requestRuntimeCancel(runtime);

  assert.equal(runtime.cancelRequested, true);
  assert.equal(runtime.agents[0]?.task, "Stopping workflow…");
  assert.throws(() => ensureRuntimeActive(runtime), WorkflowCancelledError);
});

test("requestRuntimeCancel aborts the active provider request", () => {
  const runtime = createUserRuntime(makeAgents);
  runtime.workflowAbortController = new AbortController();
  requestRuntimeCancel(runtime);
  assert.equal(runtime.workflowAbortController.signal.aborted, true);
});
