import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowInputs, topoSort } from "../workflowRunner";
import { Workflow } from "../workflowTypes";

test("topoSort returns dependency-safe order", () => {
  const workflow: Workflow = {
    nodes: [
      { id: "plan", type: "planner" },
      { id: "code", type: "coder" },
      { id: "review", type: "reviewer" },
      { id: "fix", type: "debugger" },
    ],
    edges: [
      { from: "plan", to: "code" },
      { from: "code", to: "review" },
      { from: "code", to: "fix" },
      { from: "review", to: "fix" },
    ],
  };

  const order = topoSort(workflow).map((node) => node.id);

  assert.deepEqual(order, ["plan", "code", "review", "fix"]);
});

test("getWorkflowInputs derives combined, latest code, and latest review from predecessors", () => {
  const workflow: Workflow = {
    nodes: [
      { id: "code", type: "coder" },
      { id: "review", type: "reviewer" },
      { id: "fix", type: "debugger" },
    ],
    edges: [
      { from: "code", to: "fix" },
      { from: "review", to: "fix" },
    ],
  };

  const outputs = new Map<string, string>([
    ["code", "const value = 1;"],
    ["review", "Bug found on line 1"],
  ]);

  const inputs = getWorkflowInputs("fix", workflow.edges, outputs, workflow, "task");

  assert.equal(inputs.combined, "const value = 1;\n\nBug found on line 1");
  assert.equal(inputs.latestCode, "const value = 1;");
  assert.equal(inputs.latestReview, "Bug found on line 1");
});
