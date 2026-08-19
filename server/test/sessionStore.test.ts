import test from "node:test";
import assert from "node:assert/strict";
import { canAccessSession, Session } from "../sessionStore";

function makeSession(userId?: string): Session {
  return {
    id: "session-1",
    task: "Build feature",
    createdAt: Date.now(),
    frames: [],
    events: [],
    totalCostUsd: 0,
    userId,
  };
}

test("canAccessSession allows the owner", () => {
  assert.equal(canAccessSession(makeSession("user-1"), "user-1"), true);
});

test("canAccessSession blocks other users from private sessions", () => {
  assert.equal(canAccessSession(makeSession("user-1"), "user-2"), false);
});

test("canAccessSession allows access when no user filter is applied", () => {
  assert.equal(canAccessSession(makeSession("user-1")), true);
});
