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
