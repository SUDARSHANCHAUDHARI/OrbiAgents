import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityEvent, AgentSession } from "../src/shared/contracts";
import { runtimeUsage } from "../src/renderer/src/command/usageViewModel";

test("runtime usage reports measured session activity without inventing tokens or cost", () => {
  const events = [
    { id: "1", agentId: "alpha", type: "provider-activity", source: "codex-jsonl", state: "coding", summary: "Codex file change", timestamp: 1 },
    { id: "2", agentId: "alpha", type: "provider-activity", source: "codex-jsonl", state: "reading", summary: "Codex web search", timestamp: 2 },
    { id: "3", agentId: "beta", type: "session-started", source: "lifecycle", summary: "started", timestamp: 3 },
  ] satisfies ActivityEvent[];
  const agents = [
    { id: "alpha", name: "Builder", runtimeId: "codex", cwd: "/repo", status: "running", outputTail: "", startedAt: 1_000, workspace: { sourcePath: "/repo", path: "/repo", status: "direct" } },
    { id: "beta", name: "Reviewer", runtimeId: "claude", cwd: "/repo", status: "exited", outputTail: "", startedAt: 1_000, exitedAt: 61_000, workspace: { sourcePath: "/repo", path: "/repo", status: "direct" } },
  ] satisfies AgentSession[];
  assert.deepEqual(runtimeUsage(events, agents, 121_000), { totalSignals: 3, providerSignals: 2, activeMinutes: 3, reportedInputTokens: 0, reportedOutputTokens: 0, reportedCachedInputTokens: 0, reportedCostUsd: 0, byState: [{ state: "coding", count: 1 }, { state: "reading", count: 1 }], byAgent: [{ agentId: "alpha", name: "Builder", count: 2 }] });
});

test("runtime usage prefers the latest provider-reported session total over incremental events", () => {
  const events = [
    { id: "1", agentId: "alpha", type: "provider-activity", source: "codex-jsonl", state: "done", summary: "turn", timestamp: 1, usage: { scope: "event", inputTokens: 10, outputTokens: 2 } },
    { id: "2", agentId: "alpha", type: "provider-activity", source: "codex-jsonl", state: "thinking", summary: "total", timestamp: 2, usage: { scope: "session-total", inputTokens: 40, outputTokens: 8, cachedInputTokens: 5 } },
    { id: "3", agentId: "beta", type: "provider-activity", source: "claude-transcript", state: "done", summary: "result", timestamp: 3, usage: { scope: "event", inputTokens: 7, outputTokens: 3, costUsd: 0.0123456 } },
  ] satisfies ActivityEvent[];
  assert.deepEqual(runtimeUsage(events, [], 0), { totalSignals: 3, providerSignals: 3, activeMinutes: 0, reportedInputTokens: 47, reportedOutputTokens: 11, reportedCachedInputTokens: 5, reportedCostUsd: 0.012346, byState: [{ state: "done", count: 2 }, { state: "thinking", count: 1 }], byAgent: [{ agentId: "alpha", name: "alpha", count: 2 }, { agentId: "beta", name: "beta", count: 1 }] });
});
