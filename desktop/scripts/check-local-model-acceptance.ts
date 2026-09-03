import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalModelClient } from "../src/main/models/localModelClient";
import { LocalModelEndpointStore } from "../src/main/models/localModelEndpointStore";
import { SupervisorService } from "../src/main/hive/supervisorService";
import type { AgentSession } from "../src/shared/contracts";

async function main() {
  const model = process.argv[2];
  if (!model) throw new Error("Usage: node --import tsx scripts/check-local-model-acceptance.ts <installed-model> [loopback-v1-url]");
  const root = await mkdtemp(join(tmpdir(), "orbi-live-model-"));
  const endpoints = new LocalModelEndpointStore(join(root, "endpoints.json"), { isAvailable: () => false, encrypt: () => { throw new Error("Credentials are not used by this check"); }, decrypt: () => { throw new Error("Credentials are not used by this check"); } });
  const client = new LocalModelClient(endpoints);
  const supervisor = new SupervisorService(client, {
    assign: async () => { throw new Error("Smoke checks must not dispatch work"); },
    snapshot: async () => { throw new Error("Smoke checks must not read project data"); },
    transitionTask: async () => { throw new Error("Smoke checks must not mutate tasks"); },
  }, () => [{ id: "acceptance-worker", status: "running", workspace: { sourcePath: root } }] as AgentSession[]);
  try {
    await endpoints.create({ id: "acceptance", name: "Isolated acceptance endpoint", baseUrl: process.argv[3] ?? "http://127.0.0.1:11434/v1", defaultModel: model });
    const probe = await client.probe("acceptance");
    assert.ok(probe.models.includes(model), "Requested model was not advertised by the endpoint");
    const response = await client.complete({ id: "acceptance", requestId: "live-inference", prompt: "Reply with exactly ORBI_LOCAL_OK and nothing else." });
    assert.ok(response.text.includes("ORBI_LOCAL_OK"), "The live response did not contain the requested marker");
    const run = await supervisor.plan(root, { id: "acceptance", requestId: "live-planner", prompt: "Plan two small read-only steps: inspect a fictional README for its project name, then check that the fictional README describes a test command. Do not modify files or run any command. This is only a planning smoke test." });
    assert.equal(run.status, "review"); assert.ok(run.steps.length >= 1 && run.steps.length <= 6);
    console.log(JSON.stringify({ model, probe: "passed", inference: "passed", supervisorPlan: "passed", steps: run.steps.length, dispatchedTasks: 0, boundary: "Live local model; no real worker CLI or graphical app exercised" }));
  } finally { client.dispose(); supervisor.dispose(); await rm(root, { recursive: true, force: true }); }
}

void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Local model acceptance failed"); process.exitCode = 1; });
