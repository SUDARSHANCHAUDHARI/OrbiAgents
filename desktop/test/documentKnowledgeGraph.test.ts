import assert from "node:assert/strict";
import test from "node:test";
import { DocumentKnowledgeGraphBuilder } from "../src/main/memory/documentKnowledgeGraph";

test("document graph creates deterministic provenance-backed relationships from bounded text files", async () => {
  const documents = new Map([
    ["docs/runtime.md", "# Runtime Safety\nCircuit breaker runtime safety and operator control."],
    ["docs/recovery.md", "# Recovery\nRuntime recovery uses circuit breaker evidence and operator review."],
  ]);
  const graph = await new DocumentKnowledgeGraphBuilder({
    async list() { return [...documents].map(([path, content]) => ({ path, name: path.split("/").at(-1)!, type: "file" as const, depth: 1, size: content.length, editable: true })); },
    async read(_root, path) { const content = documents.get(String(path))!; return { path: String(path), content, hash: "hash", language: "markdown" }; },
  }).build("/repo");
  assert.deepEqual(graph.nodes.map((node) => [node.path, node.title]), [["docs/runtime.md", "Runtime Safety"], ["docs/recovery.md", "Recovery"]]);
  assert.deepEqual(graph.edges, [{ sourceId: "docs/runtime.md", targetId: "docs/recovery.md", sharedTerms: ["runtime", "breaker", "circuit", "operator"] }]);
  assert.equal(graph.truncated, false);
});

test("document graph ignores non-document and oversized files", async () => {
  const graph = await new DocumentKnowledgeGraphBuilder({
    async list() { return [{ path: "secret.bin", name: "secret.bin", type: "file", depth: 0, size: 5, editable: true }, { path: "huge.md", name: "huge.md", type: "file", depth: 0, size: 200_000, editable: true }]; },
    async read() { throw new Error("must not read"); },
  }).build("/repo");
  assert.deepEqual(graph, { nodes: [], edges: [], truncated: false });
});

test("document query returns bounded ranked snippets with source paths", async () => {
  const documents = new Map([
    ["docs/runtime.md", "# Runtime Safety\nCircuit breaker runtime safety and operator control. Runtime budgets stop runaway work."],
    ["docs/recovery.md", "# Recovery\nOperator review restores interrupted sessions."],
  ]);
  const builder = new DocumentKnowledgeGraphBuilder({
    async list() { return [...documents].map(([path, content]) => ({ path, name: path.split("/").at(-1)!, type: "file" as const, depth: 1, size: content.length })); },
    async read(_root, path) { const content = documents.get(String(path))!; return { path: String(path), content, hash: "hash", language: "markdown" }; },
  });
  assert.deepEqual(await builder.query("/repo", "runtime operator", 1), [{ path: "docs/runtime.md", title: "Runtime Safety", snippet: "# Runtime Safety Circuit breaker runtime safety and operator control. Runtime budgets stop runaway work.", matchedTerms: ["operator", "runtime"] }]);
  await assert.rejects(() => builder.query("/repo", "runtime", 11), /limit is invalid/);
});

test("document query prioritizes exact phrases and title matches", async () => {
  const documents = new Map([["a.md", "# Notes\nrelease words appear release many times"], ["b.md", "# Release Process\nThe release process is controlled."]]);
  const builder = new DocumentKnowledgeGraphBuilder({ async list() { return [...documents].map(([path, content]) => ({ path, name: path, type: "file" as const, depth: 0, size: content.length })); }, async read(_root, path) { return { path: String(path), content: documents.get(String(path))!, hash: "x", language: "markdown" }; } });
  assert.equal((await builder.query("/repo", "release process", 2))[0]?.path, "b.md");
});
