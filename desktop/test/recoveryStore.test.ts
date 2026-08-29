import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RecoveryStore } from "../src/main/persistence/recoveryStore";

test("recovery report captures interrupted sessions and only unfinished durable work", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-recovery-")); const file = path.join(root, "recovery.json");
  const store = new RecoveryStore(file, 20, () => 500);
  const report = await store.create([{ id: "agent", name: "Coder", runtimeId: "codex", sourcePath: "/repo", workspacePath: "/worktree", startedAt: 10, recoveredAt: 400 }], [{ projectPath: "/repo", tasks: [{ id: "open", title: "Open", status: "in-progress", assigneeAgentId: "agent", updatedAt: 300 }, { id: "done", title: "Done", status: "completed", updatedAt: 200 }], approvals: [{ id: "approval", title: "Spend", status: "pending", createdAt: 250 }], missions: [{ id: "mission", title: "Audit", pendingRunId: "run", updatedAt: 350 }, { id: "idle", title: "Idle", updatedAt: 100 }] }]);
  assert.deepEqual(report.items.map((entry) => entry.kind), ["interrupted-session", "pending-mission", "unfinished-task", "pending-approval"]);
  assert.equal(report.items.some((entry) => entry.relatedId === "done" || entry.relatedId === "idle"), false);
  assert.equal(JSON.parse(await readFile(file, "utf8")).version, 1);
});

test("recovery report is bounded and corrupt persisted reports fail closed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-recovery-")); const file = path.join(root, "recovery.json");
  const store = new RecoveryStore(file, 1, () => 500);
  const report = await store.create([], [{ projectPath: "/repo", tasks: [{ id: "one", title: "One", status: "pending", updatedAt: 1 }, { id: "two", title: "Two", status: "blocked", updatedAt: 2 }], approvals: [], missions: [] }]);
  assert.equal(report.items.length, 1); assert.equal(report.truncated, true); assert.equal(report.items[0].relatedId, "two");
  await writeFile(file, JSON.stringify({ version: 1, generatedAt: 1, truncated: false, items: [{ id: "bad" }] }), "utf8");
  assert.equal(await store.load(), null);
});

test("malformed historical records are skipped instead of blocking startup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-recovery-"));
  const store = new RecoveryStore(path.join(root, "recovery.json"), 10, () => 500);
  const report = await store.create([{ id: "", name: "", runtimeId: "codex", sourcePath: "", workspacePath: "", startedAt: 1, recoveredAt: Number.NaN }], [{ projectPath: "/repo", tasks: [{ id: "", title: "", status: "pending", updatedAt: 1 }], approvals: [], missions: [] }]);
  assert.deepEqual(report.items, []);
});

test("interrupted session evidence survives a later window inventory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-recovery-")); const store = new RecoveryStore(path.join(root, "recovery.json"), 10, () => 500);
  await store.create([{ id: "agent", name: "Agent", runtimeId: "codex", sourcePath: "/repo", workspacePath: "/repo", startedAt: 1, recoveredAt: 400 }], []);
  const reopened = await store.create([], []);
  assert.equal(reopened.items.length, 1); assert.equal(reopened.items[0].kind, "interrupted-session"); assert.equal(reopened.items[0].detectedAt, 400);
});
