import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AgentMetadataStore } from "../src/main/agents/agentMetadataStore";

test("metadata store excludes terminal output and process ids", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-metadata-"));
  const file = path.join(directory, "agents.json");
  const store = new AgentMetadataStore(file);
  await store.save([{ id: "alpha", name: "Alpha", runtimeId: "codex", cwd: "/workspace", status: "running", pid: 42, outputTail: "secret terminal output", startedAt: 1, workspace: { sourcePath: "/workspace", path: "/workspace", status: "direct" } }]);
  const raw = await readFile(file, "utf8");
  assert.doesNotMatch(raw, /secret terminal output|"pid"/);
});

test("metadata store never presents a previous process as still running", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-metadata-"));
  const file = path.join(directory, "agents.json");
  await writeFile(file, JSON.stringify([{ id: "alpha", name: "Alpha", runtimeId: "claude", cwd: "/workspace", status: "running", startedAt: 1, workspace: { sourcePath: "/repo", path: "/worktrees/alpha", status: "active" } }]));
  const sessions = await new AgentMetadataStore(file).load();
  assert.equal(sessions[0].status, "exited");
  assert.equal(sessions[0].exitCode, -1);
  assert.equal(sessions[0].outputTail, "");
  assert.equal(sessions[0].workspace.status, "preserved");
});

test("metadata load reports exactly which prior processes were interrupted", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-metadata-")); const file = path.join(directory, "agents.json");
  await writeFile(file, JSON.stringify([{ id: "alpha", name: "Alpha", runtimeId: "codex", cwd: "/worktree", status: "stopping", startedAt: 1, workspace: { sourcePath: "/repo", path: "/worktree", status: "active" } }, { id: "done", name: "Done", runtimeId: "claude", cwd: "/repo", status: "exited", startedAt: 1, exitedAt: 2, workspace: { sourcePath: "/repo", path: "/repo", status: "direct" } }]));
  const result = await new AgentMetadataStore(file, () => 99).loadWithRecovery();
  assert.deepEqual(result.interrupted, [{ id: "alpha", name: "Alpha", runtimeId: "codex", sourcePath: "/repo", workspacePath: "/worktree", startedAt: 1, recoveredAt: 99 }]);
  assert.equal(result.sessions[0].exitedAt, 99); assert.equal(result.sessions[1].status, "exited");
});

test("metadata store ignores malformed entries", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-metadata-"));
  const file = path.join(directory, "agents.json");
  await writeFile(file, JSON.stringify([{ id: "bad" }, null, "text"]));
  assert.deepEqual(await new AgentMetadataStore(file).load(), []);
});

test("metadata store tolerates a corrupted state file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-metadata-"));
  const file = path.join(directory, "agents.json");
  await writeFile(file, "{not-json");
  assert.deepEqual(await new AgentMetadataStore(file).load(), []);
});
