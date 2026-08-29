import assert from "node:assert/strict";
import test from "node:test";
import { AgentRegistry } from "../src/main/agents/agentRegistry";

function session() {
  return {
    id: "alpha",
    name: "Orbi Alpha",
    runtimeId: "codex" as const,
    cwd: "/workspace",
    status: "starting" as const,
    outputTail: "",
    startedAt: 1,
    workspace: { sourcePath: "/workspace", path: "/workspace", status: "direct" as const },
  };
}

test("registry prevents duplicate agents and returns defensive copies", () => {
  const registry = new AgentRegistry();
  registry.add(session());
  assert.throws(() => registry.add(session()), /already exists/);
  const copy = registry.require("alpha");
  copy.name = "Changed outside";
  assert.equal(registry.require("alpha").name, "Orbi Alpha");
});

test("registry preserves id across updates", () => {
  const registry = new AgentRegistry();
  registry.add(session());
  const updated = registry.update("alpha", { id: "replacement", status: "running", pid: 42 });
  assert.equal(updated.id, "alpha");
  assert.equal(updated.status, "running");
  assert.equal(updated.pid, 42);
});
