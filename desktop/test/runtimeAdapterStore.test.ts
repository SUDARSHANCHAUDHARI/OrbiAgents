import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RuntimeAdapterStore, validateAdapterArgs, validateCustomAdapterId } from "../src/main/providers/runtimeAdapterStore";

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-adapters-"));
  const executable = path.join(directory, "agent-cli");
  await writeFile(executable, "#!/bin/sh\n", "utf8");
  await chmod(executable, 0o700);
  return { directory, executable, file: path.join(directory, "adapters.json") };
}

test("store includes the supported engine catalog and persists bounded custom descriptors", async () => {
  const { executable, file } = await fixture();
  const store = new RuntimeAdapterStore(file);
  await store.load();
  assert.deepEqual(store.list().filter((item) => item.builtin).map((item) => item.id), ["codex", "claude", "gemini", "antigravity", "grok", "kimi", "qwen", "opencode", "crush", "pi", "copilot", "cursor"]);
  const adapters = await store.create({ id: "my-agent", name: "My Agent", command: executable, args: ["--safe", "literal value"] });
  assert.equal(adapters.at(-1)?.id, "custom:my-agent");
  const reloaded = new RuntimeAdapterStore(file);
  await reloaded.load();
  assert.deepEqual(reloaded.get("custom:my-agent")?.args, ["--safe", "literal value"]);
  assert.equal((await readFile(file, "utf8")).includes("My Agent"), true);
});

test("store rejects unsafe custom descriptors and duplicate ids", async () => {
  const { executable, file } = await fixture();
  const store = new RuntimeAdapterStore(file); await store.load();
  await assert.rejects(store.create({ id: "UPPER", name: "Agent", command: executable, args: [] }), /Adapter id/);
  await assert.rejects(store.create({ id: "relative", name: "Agent", command: "agent-cli", args: [] }), /absolute path/);
  assert.throws(() => validateAdapterArgs(["x".repeat(1_001)]), /argument is invalid/);
  assert.equal(validateCustomAdapterId("safe-1"), "custom:safe-1");
  await store.create({ id: "safe", name: "Agent", command: executable, args: [] });
  await assert.rejects(store.create({ id: "safe", name: "Agent", command: executable, args: [] }), /already exists/);
});

test("store ignores malformed persistence and protects built-in or active adapters", async () => {
  const { directory, executable, file } = await fixture();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify([{ id: "custom:bad", name: "Bad", command: "relative", args: [] }, { nope: true }]), "utf8");
  const store = new RuntimeAdapterStore(file); await store.load();
  assert.equal(store.list().length, 12);
  await assert.rejects(store.remove("gemini", () => false), /Built-in/);
  await store.create({ id: "active", name: "Active", command: executable, args: [] });
  await assert.rejects(store.remove("custom:active", () => true), /Stop all agents/);
  assert.equal((await store.remove("custom:active", () => false)).length, 12);
  await writeFile(path.join(directory, "corrupt.json"), "{", "utf8");
  assert.equal((await new RuntimeAdapterStore(path.join(directory, "corrupt.json")).load()).length, 12);
});
