import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { LocalModelClient } from "../src/main/models/localModelClient";
import { LocalModelEndpointStore } from "../src/main/models/localModelEndpointStore";
import { HiveCoordinator } from "../src/main/hive/hiveCoordinator";
import { SupervisorService } from "../src/main/hive/supervisorService";
import type { AgentSession } from "../src/shared/contracts";

test("HTTP inference to approved Hive tasks to authenticated reports completes a sequential plan", { timeout: 15_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orbi-supervisor-integration-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const planner = createServer((request, response) => {
    assert.equal(request.url, "/v1/chat/completions"); assert.equal(request.method, "POST");
    let body = ""; request.on("data", (chunk) => { body += String(chunk); });
    request.on("end", () => {
      const input = JSON.parse(body); assert.equal(input.model, "fixture"); assert.equal(input.stream, false);
      assert.deepEqual(input.response_format, { type: "json_object" });
      assert.match(input.messages[0].content, /planning assistant/);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ steps: [{ title: "Inspect", detail: "Inspect the fixture only" }, { title: "Verify", detail: "Verify the fixture only" }] }) } }] }));
    });
  });
  await new Promise<void>((resolve, reject) => { planner.once("error", reject); planner.listen(0, "127.0.0.1", resolve); });
  t.after(() => { planner.close(); planner.closeAllConnections(); });
  const address = planner.address(); assert.ok(address && typeof address !== "string");
  const endpoints = new LocalModelEndpointStore(join(root, "endpoints.json"), { isAvailable: () => false, encrypt: () => { throw new Error("not used"); }, decrypt: () => { throw new Error("not used"); } });
  await endpoints.create({ id: "fixture", name: "Fixture", baseUrl: `http://127.0.0.1:${address.port}/v1`, defaultModel: "fixture" });
  const model = new LocalModelClient(endpoints); t.after(() => model.dispose());
  const agents = [{ id: "fixture-worker", status: "running", workspace: { sourcePath: root } }] as AgentSession[];
  const deliveries: string[] = [];
  const hiveRoot = join(root, "hive");
  const hive = new HiveCoordinator(hiveRoot, { list: () => agents, write: (_id: string, data: string) => deliveries.push(data) } as never);
  const supervisor = new SupervisorService(model, hive, () => agents); t.after(() => supervisor.dispose());
  const draft = await supervisor.plan(root, { id: "fixture", requestId: "plan-fixture", prompt: "Inspect and verify the fixture" });
  assert.equal(deliveries.length, 0, "Planning must not dispatch tasks");
  await supervisor.approve(root, draft.id);
  for (let index = 0; index < 2; index++) {
    assert.equal(deliveries.length, index + 1, "Only one unfinished task may be delivered");
    const instruction = deliveries[index];
    const url = /http:\/\/127\.0\.0\.1:\d+\/result\/[a-zA-Z0-9-]+/.exec(instruction)?.[0];
    const token = /Authorization: Bearer ([a-f0-9]{64})/.exec(instruction)?.[1];
    assert.ok(url && token, "Real task-report instructions must be delivered to the worker");
    const durable = await readFile(join(hiveRoot, createHash("sha256").update(root).digest("hex"), "tasks.json"), "utf8");
    assert.equal(durable.includes(token), false, "The reporting capability must not be stored with the durable task");
    const request = { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "completed", result: `Fixture worker report ${index + 1}` }) };
    assert.equal((await fetch(url, request)).status, 204);
    assert.equal((await fetch(url, request)).status, 401, "A successful report cannot be replayed");
    await supervisor.tick();
  }
  assert.equal(supervisor.status(root)?.status, "completed");
  assert.match(supervisor.status(root)!.summary, /Fixture worker report 2/);
  assert.equal((await hive.snapshot(root)).tasks.every((task) => task.status === "completed"), true);
  await delay(1); await supervisor.tick(); assert.equal(deliveries.length, 2);
});
