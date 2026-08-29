import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MarkdownMemoryStore } from "../src/main/memory/markdownMemoryStore";

test("markdown memory persists records and ranks deterministic text matches", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-memory-"));
  const store = new MarkdownMemoryStore(root);
  await store.capture({ title: "Database retry", content: "Use bounded exponential retry for database writes", source: "operator", authorAgentId: "orbi-prime" });
  await store.capture({ title: "UI colors", content: "Cyan is the office accent", source: "operator", authorAgentId: "orbi-prime" });
  const result = await store.search("database retry");
  assert.equal(result[0]?.title, "Database retry");
  const files = await readdir(join(root, "records"));
  assert.match(await readFile(join(root, "records", files[0]!), "utf8"), /^<!-- orbi-memory:/);
  assert.equal((await new MarkdownMemoryStore(root).list()).length, 2);
});

test("markdown memory rebuilds a malformed index from valid records", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-memory-"));
  const store = new MarkdownMemoryStore(root);
  await store.capture({ title: "Recover me", content: "Durable markdown source", source: "operator", authorAgentId: "agent-a" });
  await writeFile(join(root, "index.json"), "not-json", "utf8");
  await writeFile(join(root, "records", "malformed.md"), "<!-- orbi-memory:{} -->\n# Invalid\n", "utf8");
  assert.equal((await new MarkdownMemoryStore(root).search("durable"))[0]?.title, "Recover me");
});

test("markdown memory rejects unsafe file paths from a corrupted index", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-memory-"));
  await writeFile(join(root, "index.json"), JSON.stringify([{ id: "x", file: "../secret", searchText: "secret", createdAt: 1, bytes: 1 }]), "utf8");
  assert.deepEqual(await new MarkdownMemoryStore(root).search("secret"), []);
});

test("markdown memory condenses old records and remains within retention bounds", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-memory-"));
  const store = new MarkdownMemoryStore(root, { maxRecords: 3, maxTotalBytes: 50_000, maxRecordCharacters: 1_000 });
  for (let index = 0; index < 5; index += 1) await store.capture({ title: `Memory ${index}`, content: `content ${index}`, source: "operator", authorAgentId: "orbi-prime" });
  const records = await store.list();
  assert.ok(records.length <= 3);
  assert.ok(records.some((record) => record.condensed));
});

test("markdown memory rejects unbounded or invalid capture fields", async () => {
  const store = new MarkdownMemoryStore(await mkdtemp(join(tmpdir(), "orbi-memory-")), { maxRecords: 3, maxTotalBytes: 10_000, maxRecordCharacters: 10 });
  await assert.rejects(store.capture({ title: "Title", content: "content exceeds limit", source: "operator", authorAgentId: "agent-a" }), /Memory content/);
  await assert.rejects(store.capture({ title: "Title", content: "okay", source: "bad source!", authorAgentId: "agent-a" }), /Memory source/);
});
