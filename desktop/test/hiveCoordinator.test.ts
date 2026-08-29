import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HiveCoordinator } from "../src/main/hive/hiveCoordinator";

test("Hive coordinator partitions projects and assigns only recorded project agents", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-coordinator-"));
  const writes: Array<[string, string]> = [];
  const agents = {
    list: () => [{ id: "coder", status: "running", workspace: { sourcePath: "/repo-a" } }, { id: "other", status: "running", workspace: { sourcePath: "/repo-b" } }],
    write: (id: string, value: string) => writes.push([id, value]),
  };
  const coordinator = new HiveCoordinator(root, agents as never);
  const assigned = await coordinator.assign("/repo-a", { title: "Implement parser", detail: "Bound all input", agentId: "coder" });
  assert.equal(assigned.tasks.length, 1);
  assert.equal(assigned.tasks[0].assigneeAgentId, "coder");
  assert.match(writes[0][1], /Task ID:/);
  assert.equal((await coordinator.transitionTask("/repo-a", assigned.tasks[0].id, "start")).tasks[0].status, "in-progress");
  assert.equal((await coordinator.transitionTask("/repo-a", assigned.tasks[0].id, "complete", undefined, "Bounded parser delivered")).tasks[0].status, "completed");
  assert.equal((await coordinator.snapshot("/repo-a")).primeInbox.length, 1);
  await assert.rejects(coordinator.assign("/repo-a", { title: "Wrong project", detail: "Must fail", agentId: "other" }), /running project agent/);
  assert.equal((await coordinator.snapshot("/repo-b")).tasks.length, 0);
});

test("Hive coordinator leaves failed PTY deliveries durable and unacknowledged", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-coordinator-"));
  const agents = {
    list: () => [{ id: "coder", status: "running", workspace: { sourcePath: "/repo" } }],
    write: () => { throw new Error("PTY unavailable"); },
  };
  const coordinator = new HiveCoordinator(root, agents as never);
  await assert.rejects(coordinator.assign("/repo", { title: "Durable task", detail: "Must remain visible", agentId: "coder" }), /PTY unavailable/);
  const snapshot = await coordinator.snapshot("/repo");
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0].status, "assigned");
  const projectRoot = join(root, createHash("sha256").update("/repo").digest("hex"), "inbox", "coder");
  const files = await readdir(projectRoot);
  const durable = JSON.parse(await readFile(join(projectRoot, files[0]), "utf8")) as { status: string };
  assert.equal(durable.status, "delivered");
});

test("Hive coordinator partitions markdown memory by project", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-coordinator-"));
  const coordinator = new HiveCoordinator(root, { list: () => [], write: () => undefined } as never);
  await coordinator.captureMemory("/repo-a", { title: "Repo A decision", content: "Use SQLite", source: "operator", authorAgentId: "orbi-prime" });
  assert.equal((await coordinator.searchMemory("/repo-a", "sqlite")).length, 1);
  assert.equal((await coordinator.listMemory("/repo-b")).length, 0);
});

test("scheduled mission dispatch requires a matching approval and explicit run", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-coordinator-")); const writes: string[] = [];
  const coordinator = new HiveCoordinator(root, { list: () => [{ id: "coder", status: "running", workspace: { sourcePath: "/repo" } }], write: (_id: string, value: string) => writes.push(value) } as never);
  let missions = await coordinator.createMission("/repo", { title: "Scheduled audit", detail: "Review dependencies", agentId: "coder", intervalMinutes: 5, estimatedCostUsd: 0.2 });
  missions = await coordinator.setMissionEnabled("/repo", missions[0]!.id, true);
  await coordinator.processHeartbeat(missions[0]!.nextRunAt);
  missions = await coordinator.listMissions("/repo");
  await assert.rejects(coordinator.runMission("/repo", missions[0]!.id), /operator approval/);
  const approvalId = missions[0]!.pendingApprovalId!;
  await coordinator.decideApproval("/repo", approvalId, "approved", "Approved for this run");
  const completed = await coordinator.runMission("/repo", missions[0]!.id);
  assert.equal(completed[0]!.pendingRunId, undefined); assert.ok(completed[0]!.lastRunAt); assert.equal(writes.length, 1);
  assert.equal((await coordinator.snapshot("/repo")).tasks.length, 1);
});

test("failed scheduled delivery retains one pending task for safe retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-coordinator-")); let fail = true; const writes: string[] = [];
  const coordinator = new HiveCoordinator(root, { list: () => [{ id: "coder", status: "running", workspace: { sourcePath: "/repo" } }], write: (_id: string, value: string) => { if (fail) throw new Error("PTY unavailable"); writes.push(value); } } as never);
  let missions = await coordinator.createMission("/repo", { title: "Scheduled audit", detail: "Review", agentId: "coder", intervalMinutes: 5, estimatedCostUsd: 0.2 });
  missions = await coordinator.setMissionEnabled("/repo", missions[0]!.id, true); await coordinator.processHeartbeat(missions[0]!.nextRunAt); missions = await coordinator.listMissions("/repo");
  await coordinator.decideApproval("/repo", missions[0]!.pendingApprovalId!, "approved", "Approved");
  await assert.rejects(coordinator.runMission("/repo", missions[0]!.id), /PTY unavailable/);
  assert.ok((await coordinator.listMissions("/repo"))[0]!.pendingTaskId); assert.equal((await coordinator.snapshot("/repo")).tasks.length, 1);
  fail = false; await coordinator.runMission("/repo", missions[0]!.id);
  assert.equal((await coordinator.snapshot("/repo")).tasks.length, 1); assert.equal(writes.length, 1); assert.equal((await coordinator.costSnapshot()).entries.length, 1);
});
