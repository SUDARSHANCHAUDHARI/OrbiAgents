import assert from "node:assert/strict";
import test from "node:test";
import { TaskReportServer, parseWorkerReport } from "../src/main/hive/taskReportServer";

test("task reports are authenticated one-shot loopback capabilities and reject replay", async (t) => {
  const server = new TaskReportServer(); t.after(() => server.stop());
  let reports = 0;
  const instructions = await server.issue("task-1", async (report) => { assert.equal(report.result, "Tests passed"); reports++; });
  const url = /http:\/\/127\.0\.0\.1:\d+\/result\/task-1/.exec(instructions)![0];
  const token = /Bearer ([a-f0-9]{64})/.exec(instructions)![1];
  const options = { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "completed", result: "Tests passed" }) };
  assert.equal((await fetch(url, { ...options, headers: { ...options.headers, authorization: "Bearer wrong" } })).status, 401);
  assert.equal((await fetch(url, { ...options, headers: { ...options.headers, origin: "http://untrusted.test" } })).status, 403);
  assert.equal((await fetch(url, { ...options, body: "not json" })).status, 400);
  assert.equal(reports, 0);
  assert.equal((await fetch(url, options)).status, 204); assert.equal(reports, 1);
  assert.equal((await fetch(url, options)).status, 401); assert.equal(reports, 1);
});

test("revoked capabilities and concurrent duplicate reports cannot mutate a task", async (t) => {
  const server = new TaskReportServer(); t.after(() => server.stop());
  let release!: () => void; let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const instructions = await server.issue("task-2", async () => { entered(); await new Promise<void>((resolve) => { release = resolve; }); });
  const url = /http:\/\/127\.0\.0\.1:\d+\/result\/task-2/.exec(instructions)![0];
  const token = /Bearer ([a-f0-9]{64})/.exec(instructions)![1];
  const options = { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "blocked", result: "Approval needed" }) };
  const first = fetch(url, options); await started;
  assert.equal((await fetch(url, options)).status, 409); release(); assert.equal((await first).status, 204);
  const revoked = await server.issue("revoked", async () => assert.fail("must not receive")); server.revoke("revoked");
  const revokedUrl = /http:\/\/127\.0\.0\.1:\d+\/result\/revoked/.exec(revoked)![0];
  const revokedToken = /Bearer ([a-f0-9]{64})/.exec(revoked)![1];
  assert.equal((await fetch(revokedUrl, { ...options, headers: { ...options.headers, authorization: `Bearer ${revokedToken}` } })).status, 401);
});

test("worker results reject unsupported statuses and terminal controls", () => {
  for (const input of [null, {}, { status: "completed", result: "" }, { status: "completed", result: "\x1b[bad" }, { status: "execute", result: "command" }, { status: "completed", result: "x".repeat(40_001) }]) assert.throws(() => parseWorkerReport(input));
});

test("report capabilities expire after thirty minutes and cannot cross task boundaries", async (t) => {
  let now = 1; const server = new TaskReportServer(() => now); t.after(() => server.stop());
  const first = await server.issue("first", async () => assert.fail("expired or wrong capability"));
  const second = await server.issue("second", async () => assert.fail("wrong task"));
  const token = /Bearer ([a-f0-9]{64})/.exec(first)![1];
  const options = { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "completed", result: "Done" }) };
  const url = /http:\/\/127\.0\.0\.1:\d+\/result\/first/.exec(first)![0];
  const other = /http:\/\/127\.0\.0\.1:\d+\/result\/second/.exec(second)![0];
  assert.equal((await fetch(other, options)).status, 401);
  now += 30 * 60_000; assert.equal((await fetch(url, options)).status, 401);
});
