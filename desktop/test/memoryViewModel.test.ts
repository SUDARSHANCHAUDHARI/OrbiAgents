import assert from "node:assert/strict";
import test from "node:test";
import { memoryOverview, memoryRelationships } from "../src/renderer/src/command/memoryViewModel";
import type { MemoryRecord } from "../src/shared/contracts";

function memory(id: string, source: string, condensed = false): MemoryRecord {
  return { id, title: id, content: id, source, authorAgentId: "orbi-prime", createdAt: 1, condensed };
}

test("memory overview distinguishes project inventory from search results", () => {
  const records = [memory("a", "operator"), memory("b", "retention", true)];
  assert.deepEqual(memoryOverview(records, ""), { count: 2, query: "", sources: 2, condensed: 1 });
  assert.deepEqual(memoryOverview(records, "release"), { count: 2, query: "release", sources: 2, condensed: 1 });
  assert.deepEqual(memoryOverview([], "release"), { count: 0, query: "release", sources: 0, condensed: 0 });
});

test("memory relationships expose deterministic shared concepts without semantic invention", () => {
  const records = [
    { ...memory("a", "operator"), title: "Release signing", content: "macOS release signing notarization" },
    { ...memory("b", "operator"), title: "Release checklist", content: "release notarization validation" },
    { ...memory("c", "operator"), title: "Color choice", content: "violet interface palette" },
  ];
  assert.deepEqual(memoryRelationships(records), [{ sourceId: "a", targetId: "b", sharedTerms: ["release", "notarization"] }]);
});
