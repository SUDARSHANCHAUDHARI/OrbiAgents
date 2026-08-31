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
  assert.deepEqual(runtimeUsage(events, agents, 121_000), { totalSignals: 3, providerSignals: 2, activeMinutes: 3, byState: [{ state: "coding", count: 1 }, { state: "reading", count: 1 }], byAgent: [{ agentId: "alpha", name: "Builder", count: 2 }] });
});
