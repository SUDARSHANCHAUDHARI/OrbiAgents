import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  validateAgentId,
  validateAgentProfile,
  validateCreateAgentRequest,
  validateDimension,
  validateTerminalInput,
  validateRuntimeId,
} from "../src/main/security/validators";

test("agent ids accept bounded safe identifiers", () => {
  assert.equal(validateAgentId("agent_alpha-1"), "agent_alpha-1");
  assert.throws(() => validateAgentId("../agent"), /Agent id/);
  assert.throws(() => validateAgentId("a".repeat(65)), /Agent id/);
});

test("runtime ids accept built-ins and bounded custom adapter references", () => {
  assert.equal(validateRuntimeId("gemini"), "gemini");
  assert.equal(validateRuntimeId("custom:local-agent"), "custom:local-agent");
  assert.throws(() => validateRuntimeId("custom:../agent"), /Unsupported/);
});

test("terminal dimensions and input are bounded", () => {
  assert.equal(validateDimension(undefined, 100), 100);
  assert.equal(validateDimension(80, 100), 80);
  assert.throws(() => validateDimension(1, 100), /between 2 and 500/);
  assert.equal(validateTerminalInput("hello"), "hello");
  assert.throws(() => validateTerminalInput("x".repeat(65 * 1024)), /64 KB/);
});

test("create request requires an existing absolute workspace and allowlisted runtime", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "orbi-validator-"));
  const request = await validateCreateAgentRequest({ id: "alpha", name: " Orbi Alpha ", runtimeId: "codex", cwd });
  assert.deepEqual(request, { id: "alpha", name: "Orbi Alpha", runtimeId: "codex", cwd, cols: 100, rows: 30, isolateWorkspace: false, profile: { role: "generalist", goal: "", capabilities: ["planning", "coding", "testing"], budgetMinutes: 60, appearance: "cyan" } });
  await assert.rejects(validateCreateAgentRequest({ id: "alpha", name: "Alpha", runtimeId: "shell", cwd }), /Unsupported/);
  await assert.rejects(validateCreateAgentRequest({ id: "alpha", name: "Alpha", runtimeId: "codex", cwd: "relative" }), /absolute/);
});

test("agent profiles are bounded, normalized, and reject unknown options", () => {
  assert.deepEqual(validateAgentProfile({ role: "builder", goal: "  Ship the feature  ", capabilities: ["coding", "testing"], budgetMinutes: 90, appearance: "violet" }), { role: "builder", goal: "Ship the feature", capabilities: ["coding", "testing"], budgetMinutes: 90, appearance: "violet" });
  assert.throws(() => validateAgentProfile({ role: "admin", goal: "", capabilities: ["coding"], budgetMinutes: 60, appearance: "cyan" }), /role/);
  assert.throws(() => validateAgentProfile({ role: "builder", goal: "", capabilities: ["coding", "coding"], budgetMinutes: 60, appearance: "cyan" }), /capabilities/);
});
