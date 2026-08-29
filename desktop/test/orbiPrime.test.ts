import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ApprovalQueue } from "../src/main/hive/approvalQueue";
import { HiveMailbox } from "../src/main/hive/hiveMailbox";
import { OrbiPrime } from "../src/main/hive/orbiPrime";
import { HiveState } from "../src/main/hive/hiveState";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "orbi-prime-"));
  const agents = new Set(["orbi-prime", "architect", "coder", "reviewer"]);
  const mailbox = new HiveMailbox(root, (id) => agents.has(id));
  return { prime: new OrbiPrime(new HiveState(root), mailbox, new ApprovalQueue(root)), mailbox };
}

test("Orbi-Prime coordinates two agents and synthesizes only completed durable results", async () => {
  const { prime, mailbox } = await fixture();
  const design = await prime.assign({ title: "Design parser", detail: "Define bounded input behavior", agentId: "architect" });
  await prime.start(design.id);
  await prime.followUp(design.id, "Confirm malformed input handling");
  await prime.complete(design.id, "architect", "Reject malformed input and cap input at 64 KiB");
  const implementation = await prime.delegate(design.id, { title: "Implement parser", detail: "Follow the approved design", agentId: "coder" });
  await prime.start(implementation.id);
  await prime.complete(implementation.id, "coder", "Parser implemented with bounded reads");

  assert.match(await prime.synthesize([design.id, implementation.id]), /Parser implemented with bounded reads/);
  assert.equal((await mailbox.readInbox("architect")).length, 2);
  assert.equal((await mailbox.readInbox("coder")).length, 1);
  assert.equal((await mailbox.readInbox("orbi-prime")).length, 2);
});

test("Orbi-Prime retries only through the bounded task lifecycle", async () => {
  const { prime } = await fixture();
  const task = await prime.assign({ title: "Repair test", detail: "Fix the failing case", agentId: "coder", maxAttempts: 1 });
  await prime.start(task.id);
  await prime.block(task.id);
  await prime.retry(task.id, "reviewer");
  await assert.rejects(prime.start(task.id), /retry limit/);
});

test("Orbi-Prime routes critical escalation through operator approval", async () => {
  const { prime } = await fixture();
  const request = await prime.escalate({ category: "destructive-operation", title: "Discard preserved worktree", rationale: "Changes were rejected", requestedByAgentId: "orbi-prime" });
  assert.equal(request.status, "pending");
  await assert.rejects(prime.escalate({ category: "routine", title: "Read task", rationale: "Continue coordination", requestedByAgentId: "orbi-prime" }), /do not require escalation/);
});
