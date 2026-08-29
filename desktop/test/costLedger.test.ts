import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CostLedger } from "../src/main/costs/costLedger";

const authorization = { projectPath: "/repo", missionId: "mission", runId: "run", approvalId: "approval", title: "Dependency audit", estimatedCostUsd: 0.2 };
test("cost ledger appends an explicitly labeled authorization estimate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-costs-")); const ledger = new CostLedger(root, { now: () => 123 });
  const entry = await ledger.recordAuthorization(authorization); const snapshot = await ledger.snapshot();
  assert.equal(entry.kind, "authorization-estimate"); assert.equal(entry.basis, "operator-approved-scheduled-mission-estimate"); assert.equal(entry.createdAt, 123);
  assert.equal(snapshot.totalAuthorizedEstimateUsd, 0.2); assert.equal(snapshot.corrupted, false); assert.equal(snapshot.entries.length, 1);
});
test("repeating an authorization is idempotent and does not append another line", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-costs-")); const ledger = new CostLedger(root);
  const first = await ledger.recordAuthorization(authorization); const before = await readFile(path.join(root, "ledger.jsonl"), "utf8"); const second = await new CostLedger(root).recordAuthorization(authorization); const after = await readFile(path.join(root, "ledger.jsonl"), "utf8");
  assert.equal(second.id, first.id); assert.equal(after, before); assert.equal((await ledger.snapshot()).entries.length, 1);
  await assert.rejects(ledger.recordAuthorization({ ...authorization, title: "Changed title" }), /idempotency conflict/);
});
test("checksum chain detects syntactically valid edits", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-costs-")); const ledger = new CostLedger(root); await ledger.recordAuthorization(authorization);
  const file = path.join(root, "ledger.jsonl"); const entry = JSON.parse(await readFile(file, "utf8")); entry.amountUsd = 0.9; await writeFile(file, `${JSON.stringify(entry)}\n`, "utf8");
  const snapshot = await ledger.snapshot(); assert.equal(snapshot.corrupted, true); assert.equal(snapshot.entries.length, 0);
});
test("corruption preserves the readable prefix and blocks future appends", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-costs-")); const ledger = new CostLedger(root);
  await ledger.recordAuthorization(authorization); await appendFile(path.join(root, "ledger.jsonl"), "{broken\n", "utf8");
  const snapshot = await ledger.snapshot(); assert.equal(snapshot.corrupted, true); assert.equal(snapshot.entries.length, 1);
  await assert.rejects(ledger.recordAuthorization({ ...authorization, runId: "next" }), /integrity check failed/);
});
test("snapshot applies bounded newest-first reads while totaling all verified entries", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-costs-")); let now = 0; const ledger = new CostLedger(root, { now: () => ++now });
  await ledger.recordAuthorization(authorization); await ledger.recordAuthorization({ ...authorization, runId: "next", estimatedCostUsd: 0.1 });
  const snapshot = await ledger.snapshot(1); assert.equal(snapshot.truncated, true); assert.equal(snapshot.entries[0].runId, "next"); assert.equal(snapshot.totalAuthorizedEstimateUsd, 0.3);
});
