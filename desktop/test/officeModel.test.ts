import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOfficeAgents, buildOfficeLinks } from "../src/renderer/src/office/officeModel";
import { createOrbitalWorld, isWalkable, stationForState, tileAt } from "../src/renderer/src/office/orbitalWorld";
import type { AgentActivityState, HiveSnapshot } from "../src/shared/contracts";

const session = (id: string) => ({ id, name: id, runtimeId: "codex", cwd: "/repo", status: "running", outputTail: "", startedAt: 1, workspace: { sourcePath: "/repo", path: "/repo", status: "direct" } }) as const;

test("office model places real agent states at purposeful orbital stations", () => {
  const world = createOrbitalWorld();
  const agents = buildOfficeAgents([session("planner"), session("coder"), session("reviewer"), session("idle")], { planner: "thinking", coder: "coding", reviewer: "permission-waiting", idle: "idle" });
  assert.deepEqual(Object.fromEntries(agents.map((agent) => [agent.id, agent.zone])), { planner: "planning", coder: "focus", reviewer: "collaboration", idle: "lounge" });
  for (const agent of agents) {
    assert.equal(agent.stationId, stationForState(agent.state));
    assert.equal(isWalkable(tileAt(world, agent.column, agent.row)), true);
  }
});

test("office model gives same-zone agents distinct stable positions", () => {
  const agents = buildOfficeAgents([session("a"), session("b"), session("c")], { a: "coding", b: "coding", c: "coding" });
  assert.equal(new Set(agents.map((agent) => `${agent.column}:${agent.row}`)).size, 3);
  assert.deepEqual(buildOfficeAgents([session("a"), session("b"), session("c")], { a: "coding", b: "coding", c: "coding" }), agents);
});

test("office model keeps a large concurrent roster inside zones without overlapping positions", () => {
  const sessions = Array.from({ length: 64 }, (_, index) => session(`agent-${index}`));
  const states: Record<string, AgentActivityState> = Object.fromEntries(sessions.map((agent, index) => [agent.id, index % 2 ? "coding" : "thinking"]));
  const agents = buildOfficeAgents(sessions, states);
  assert.equal(agents.length, 64);
  assert.equal(new Set(agents.map((agent) => `${agent.column}:${agent.row}`)).size, 64);
});

test("office links project only real visible active Hive traffic", () => {
  const hive: HiveSnapshot = {
    tasks: [
      { id: "active", title: "A", detail: "", status: "in-progress", assigneeAgentId: "a", dependencyIds: [], attempt: 1, maxAttempts: 3, createdAt: 1, updatedAt: 1 },
      { id: "done", title: "B", detail: "", status: "completed", assigneeAgentId: "b", dependencyIds: [], attempt: 1, maxAttempts: 3, createdAt: 1, updatedAt: 1 },
    ],
    approvals: [], blackboard: {},
    primeInbox: [
      { id: "delivered", senderAgentId: "a", recipientAgentId: "orbi-prime", kind: "done", body: "result", status: "delivered", createdAt: 1 },
      { id: "acked", senderAgentId: "a", recipientAgentId: "orbi-prime", kind: "done", body: "result", status: "acknowledged", createdAt: 1 },
    ],
  };
  assert.deepEqual(buildOfficeLinks(hive, new Set(["a", "b"])), [
    { id: "task:active", fromAgentId: "a", toAgentId: "orbi-prime", kind: "task" },
    { id: "message:delivered", fromAgentId: "a", toAgentId: "orbi-prime", kind: "message" },
  ]);
});
