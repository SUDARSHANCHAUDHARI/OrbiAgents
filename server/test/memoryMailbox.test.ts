import assert from "node:assert/strict";
import test from "node:test";
import { validateMemory } from "../memoryStore";
import { MessageHopLimitError, validateMessage } from "../mailboxStore";

test("agent memory requires an agent id", () => {
  assert.throws(
    () => validateMemory({ userId: "u1", scope: "agent", content: "Remember this" }),
    /agentId is required/
  );
});

test("shared memory rejects an agent id", () => {
  assert.throws(
    () => validateMemory({ userId: "u1", scope: "shared", agentId: "planner", content: "Shared" }),
    /cannot have an agentId/
  );
});

test("mailbox prevents self-messages and runaway hops", () => {
  assert.throws(
    () => validateMessage({ userId: "u1", senderAgentId: "a", recipientAgentId: "a", kind: "inform", body: "x" }),
    /cannot message themselves/
  );
  assert.throws(
    () => validateMessage({ userId: "u1", senderAgentId: "a", recipientAgentId: "b", kind: "inform", body: "x", hopCount: 9 }),
    MessageHopLimitError
  );
  assert.throws(
    () => validateMessage({ userId: "u1", senderAgentId: "a", recipientAgentId: "b", kind: "unknown" as "inform", body: "x" }),
    /Unsupported message kind/
  );
  assert.throws(
    () => validateMessage({ userId: "u1", senderAgentId: "2", recipientAgentId: " 2 ", kind: "inform", body: "x" }),
    /cannot message themselves/
  );
});
