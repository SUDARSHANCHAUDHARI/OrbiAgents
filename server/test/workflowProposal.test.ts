import assert from "node:assert/strict";
import test from "node:test";
import { proposeWorkflowImprovement, validateWorkflowGraph } from "../workflowProposal";

test("supervisor proposes a bounded tester insertion without mutating the input", () => {
  const workflow = { nodes: [{ id: "plan", type: "planner" as const }, { id: "code", type: "coder" as const }, { id: "review", type: "reviewer" as const }], edges: [{ from: "plan", to: "code" }, { from: "code", to: "review" }] };
  const proposal = proposeWorkflowImprovement(workflow);
  assert.equal(proposal.changed, true);
  assert.equal(proposal.kind, "add-role");
  assert.match(proposal.summary, /Tester/);
  assert.deepEqual(workflow.edges, [{ from: "plan", to: "code" }, { from: "code", to: "review" }]);
  assert.deepEqual(proposal.workflow.edges, [{ from: "plan", to: "code" }, { from: "code", to: "orbi-tester-1" }, { from: "orbi-tester-1", to: "review" }]);
});

test("supervisor can propose a non-structural label normalization", () => {
  const workflow = { nodes: ["planner", "coder", "tester", "reviewer", "debugger"].map((type, index) => ({ id: `n${index}`, type: type as "planner", label: index === 0 ? undefined : type })), edges: [] };
  const proposal = proposeWorkflowImprovement(workflow);
  assert.equal(proposal.kind, "normalize-label");
  assert.equal(proposal.workflow.nodes[0].label, "Planner");
});

test("workflow proposal validation rejects cycles and duplicate ids", () => {
  assert.throws(() => validateWorkflowGraph({ nodes: [{ id: "a", type: "planner" }, { id: "a", type: "coder" }], edges: [] }), /unique/);
  assert.throws(() => validateWorkflowGraph({ nodes: [{ id: "a", type: "unknown" as "planner" }], edges: [] }), /unsupported/);
  assert.throws(() => validateWorkflowGraph({ nodes: [{ id: "a", type: "planner" }, { id: "b", type: "coder" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }] }), /cycle/);
});
