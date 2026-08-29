import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CodexRolloutWatcher } from "../src/main/activity/codexRolloutWatcher";

test("Codex rollout watcher binds by verified cwd and emits sanitized appended facts", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-rollout-"));
  const day = join(root, "2026", "08", "27");
  await mkdir(day, { recursive: true });
  const rollout = join(day, "rollout.jsonl");
  const received: Array<{ agentId: string; summary: string }> = [];
  const watcher = new CodexRolloutWatcher(root, (cwd) => cwd === "/worktree/agent-1" ? "agent-1" : undefined, (agentId, event) => received.push({ agentId, summary: event.summary }));

  await writeFile(rollout, `${JSON.stringify({ type: "session_meta", payload: { session_id: "s1", cwd: "/worktree/agent-1", base_instructions: "private" } })}\n`);
  await watcher.scan();
  await appendFile(rollout, `${JSON.stringify({ type: "event_msg", payload: { type: "task_started", message: "private" } })}\n`);
  await watcher.scan();

  assert.deepEqual(received, [{ agentId: "agent-1", summary: "Codex task started" }]);
  watcher.stop();
});

test("Codex rollout watcher does not bind an unresolved workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-rollout-"));
  const rollout = join(root, "rollout.jsonl");
  await writeFile(rollout, `${JSON.stringify({ type: "session_meta", payload: { session_id: "s2", cwd: "/ambiguous" } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "task_started" } })}\n`);
  const received: unknown[] = [];
  const watcher = new CodexRolloutWatcher(root, () => undefined, (_agentId, event) => received.push(event));
  await watcher.scan();
  assert.deepEqual(received, []);
});
