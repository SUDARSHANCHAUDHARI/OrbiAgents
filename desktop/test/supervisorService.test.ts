import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AgentSession } from "../src/shared/contracts";
import { HiveCoordinator } from "../src/main/hive/hiveCoordinator";
import { SupervisorService, parseSupervisorSteps } from "../src/main/hive/supervisorService";
import type { TaskReportChannel, WorkerReport } from "../src/main/hive/taskReportServer";

class Reports implements TaskReportChannel {
  callbacks = new Map<string, (report: WorkerReport) => Promise<void>>();
  async issue(key: string, receive: (report: WorkerReport) => Promise<void>) { this.callbacks.set(key, receive); return "Ephemeral reporting instructions"; }
  revoke(key: string) { this.callbacks.delete(key); }
  stop() { this.callbacks.clear(); }
}

const input = { id: "local", model: "test", requestId: "request", prompt: "Implement and test a parser" };
const plan = { steps: [{ title: "Build", detail: "Implement parser with bounded input" }, { title: "Test", detail: "Run parser tests" }] };

test("supervisor review approval sequential dispatch and recorded result synthesis", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orbi-supervisor-")); t.after(() => rm(root, { recursive: true, force: true }));
  const writes: string[] = [];
  const agents = [{ id: "builder", status: "running", workspace: { sourcePath: "/repo" }, profile: { role: "builder" } }] as AgentSession[];
  const hive = new HiveCoordinator(root, { list: () => agents, write: (_id: string, text: string) => writes.push(text) } as never);
  const reports = new Reports();
  const service = new SupervisorService({ complete: async () => ({ text: JSON.stringify(plan), model: "test" }) }, hive, () => agents, reports);
  const draft = await service.plan("/repo", input);
  assert.equal(draft.status, "review"); assert.equal(writes.length, 0);
  draft.steps[0].detail = "tampered"; assert.notEqual(service.status("/repo")!.steps[0].detail, "tampered");
  await assert.rejects(service.approve("/other", draft.id), /stale/);
  await service.approve("/repo", draft.id); assert.equal(writes.length, 1);
  await assert.rejects(service.approve("/repo", draft.id), /approval/);
  await Promise.all([service.tick(), service.tick()]); assert.equal(writes.length, 1);
  let task = (await hive.snapshot("/repo")).tasks[0];
  await reports.callbacks.get(`${draft.id}-0`)!({ status: "completed", result: "Parser implemented; unit checks passed" });
  assert.doesNotMatch(task.detail, /Ephemeral reporting/);
  await Promise.all([service.tick(), service.tick()]); assert.equal(writes.length, 2);
  task = (await hive.snapshot("/repo")).tasks[1];
  await reports.callbacks.get(`${draft.id}-1`)!({ status: "completed", result: "Tests passed" });
  await service.tick(); assert.equal(service.status("/repo")!.status, "completed");
  assert.match(service.status("/repo")!.summary, /Parser implemented/);
  assert.equal((await hive.snapshot("/other")).tasks.length, 0);
});

test("supervisor ambiguous delivery pauses and never blindly duplicates", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orbi-supervisor-")); t.after(() => rm(root, { recursive: true, force: true }));
  const agents = [{ id: "worker", status: "running", workspace: { sourcePath: "/repo" } }] as AgentSession[];
  let writes = 0;
  const hive = new HiveCoordinator(root, { list: () => agents, write: () => { writes++; throw new Error("ambiguous delivery"); } } as never);
  const service = new SupervisorService({ complete: async () => ({ text: JSON.stringify(plan), model: "test" }) }, hive, () => agents, new Reports());
  const draft = await service.plan("/repo", input); await service.approve("/repo", draft.id);
  assert.equal(service.status("/repo")!.status, "paused"); await service.tick(); assert.equal(writes, 1);
  await assert.rejects(service.plan("/repo", input), /Cancel/);
  service.cancel("/repo", draft.id); await service.tick(); assert.equal(writes, 1);
  assert.equal((await hive.snapshot("/repo")).tasks.length, 1);
});

test("blocked worker reports pause the plan and operator retries are bounded before dispatch", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orbi-supervisor-")); t.after(() => rm(root, { recursive: true, force: true }));
  const agents = [{ id: "worker", status: "running", workspace: { sourcePath: "/repo" } }] as AgentSession[];
  const writes: string[] = []; const reports = new Reports();
  const hive = new HiveCoordinator(root, { list: () => agents, write: (_id: string, data: string) => writes.push(data) } as never);
  const service = new SupervisorService({ complete: async () => ({ text: JSON.stringify(plan), model: "test" }) }, hive, () => agents, reports);
  const run = await service.plan("/repo", input); await service.approve("/repo", run.id);
  await reports.callbacks.get(`${run.id}-0`)!({ status: "blocked", result: "Need scope approval" });
  assert.equal(service.status("/repo")!.status, "paused"); await service.tick(); assert.equal(writes.length, 1);
  await service.resume("/repo", run.id); assert.equal(writes.length, 2);
  await reports.callbacks.get(`${run.id}-0`)!({ status: "blocked", result: "Still blocked" });
  await assert.rejects(service.resume("/repo", run.id), /retry limit/); assert.equal(writes.length, 2);
  service.cancel("/repo", run.id); assert.equal(reports.callbacks.size, 0);
});

test("planner rejects malformed, oversized or control-bearing steps", () => {
  for (const value of ["bad", "null", "{}", JSON.stringify({ steps: [] }), JSON.stringify({ steps: Array(7).fill(plan.steps[0]) }), JSON.stringify({ steps: [{ title: "x", detail: "\x1b[bad" }] })]) assert.throws(() => parseSupervisorSteps(value));
  assert.deepEqual(parseSupervisorSteps(JSON.stringify(plan)), plan.steps);
});

test("cancelled review and disposed service cannot dispatch", async () => {
  const agents = [{ id: "worker", status: "running", workspace: { sourcePath: "/repo" } }] as AgentSession[];
  const service = new SupervisorService({ complete: async () => ({ text: JSON.stringify(plan), model: "test" }) }, { assign: async () => { assert.fail("must not dispatch"); }, snapshot: async () => { assert.fail("must not inspect"); }, transitionTask: async () => { assert.fail("must not transition"); } }, () => agents);
  const run = await service.plan("/repo", input); service.cancel("/repo", run.id);
  await assert.rejects(service.approve("/repo", run.id), /approval/);
  service.dispose(); await service.tick(); await assert.rejects(service.plan("/repo", input), /closed/);
});
