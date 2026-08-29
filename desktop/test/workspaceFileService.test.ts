import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WorkspaceFileService } from "../src/main/workspaces/workspaceFileService";

async function fixture() { const root = await mkdtemp(path.join(os.tmpdir(), "orbi-files-")); await mkdir(path.join(root, "src")); await writeFile(path.join(root, "src", "app.ts"), "export const value = 1;\n"); return root; }

test("file service lists and reads bounded text while excluding sensitive and dependency paths", async () => {
  const root = await fixture(); await writeFile(path.join(root, ".env"), "SECRET=value"); await writeFile(path.join(root, ".npmrc"), "token=value"); await mkdir(path.join(root, "node_modules")); await writeFile(path.join(root, "node_modules", "hidden.js"), "x");
  const service = new WorkspaceFileService(); const entries = await service.list(root);
  assert.deepEqual(entries.map((entry) => entry.path), ["src", "src/app.ts"]);
  const file = await service.read(root, "src/app.ts"); assert.equal(file.content, "export const value = 1;\n"); assert.equal(file.language, "typescript"); assert.match(file.hash, /^[a-f0-9]{64}$/);
  await assert.rejects(service.read(root, ".env"), /unsafe/);
});

test("file service rejects traversal, symlinks, binary files, and oversized files", async () => {
  const root = await fixture(); const outside = path.join(path.dirname(root), "outside.txt"); await writeFile(outside, "outside"); await symlink(outside, path.join(root, "link.txt")); await writeFile(path.join(root, "binary.bin"), Buffer.from([1, 0, 2])); await writeFile(path.join(root, "large.txt"), Buffer.alloc(1024 * 1024 + 1));
  const service = new WorkspaceFileService();
  await assert.rejects(service.read(root, "../outside.txt"), /unsafe/);
  await assert.rejects(service.read(root, "link.txt"), /symbolic link/);
  await assert.rejects(service.read(root, "binary.bin"), /Binary/);
  await assert.rejects(service.read(root, "large.txt"), /no larger than 1 MB/);
});

test("file service saves atomically only when the expected hash still matches", async () => {
  const root = await fixture(); const service = new WorkspaceFileService(); const opened = await service.read(root, "src/app.ts");
  const saved = await service.write(root, "src/app.ts", "export const value = 2;\n", opened.hash);
  assert.equal(saved.content, "export const value = 2;\n"); assert.notEqual(saved.hash, opened.hash); assert.equal(await readFile(path.join(root, "src", "app.ts"), "utf8"), saved.content);
  await assert.rejects(service.write(root, "src/app.ts", "stale", opened.hash), /changed since/);
});

test("file service parses bounded history and validates revision reads", async () => {
  const root = await fixture(); const hash = "a".repeat(40); const calls: string[][] = [];
  const service = new WorkspaceFileService({ async run(args) { calls.push(args); if (args.includes("log")) return `${hash}\x1f123\x1fInitial commit\x1e`; if (args.includes("--show-prefix")) return ""; if (args.includes("show")) return "historic\n"; return ""; } });
  assert.deepEqual(await service.history(root, "src/app.ts"), [{ revision: hash, timestamp: 123000, subject: "Initial commit" }]);
  const revision = await service.readRevision(root, "src/app.ts", hash); assert.equal(revision.content, "historic\n"); assert.equal(revision.readOnly, true); assert.equal(calls.at(-1)?.at(-1), `${hash}:src/app.ts`);
  await assert.rejects(service.readRevision(root, "src/app.ts", "HEAD~1"), /revision is invalid/);
});
