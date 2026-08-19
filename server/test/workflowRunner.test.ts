import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowInputs, runWorkflowDynamic, topoSort } from "../workflowRunner";
import { Workflow } from "../workflowTypes";
import { StreamResult } from "../ai";
import { OrbiPrimeSupervisor, SupervisorEvent } from "../supervisor";

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

test("dynamic workflow runs independent branches concurrently and waits for dependencies", async () => {
  const workflow: Workflow = {
    nodes: [
      { id: "plan", type: "planner" },
      { id: "test", type: "tester" },
      { id: "review", type: "reviewer" },
      { id: "fix", type: "debugger" },
    ],
    edges: [
      { from: "plan", to: "test" },
      { from: "plan", to: "review" },
      { from: "test", to: "fix" },
      { from: "review", to: "fix" },
    ],
  };
  let active = 0;
  let peak = 0;
  const finished = new Set<string>();
  const result = await runWorkflowDynamic(
    workflow,
    "task",
    () => {},
    async () => {},
    "anthropic",
    {
      maxConcurrency: 2,
      executeNode: async (node): Promise<StreamResult> => {
        if (node.id === "fix") {
          assert.equal(finished.has("test"), true);
          assert.equal(finished.has("review"), true);
        }
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, node.id === "plan" ? 1 : 20));
        active -= 1;
        finished.add(node.id);
        return {
          text: node.id,
          inputTokens: 1,
          outputTokens: 1,
          cacheReadTokens: 0,
          costUsd: 0,
          provider: "anthropic",
          model: "test",
        };
      },
    }
  );

  assert.equal(peak, 2);
  assert.deepEqual(result.steps.map((step) => step.nodeId), ["plan", "test", "review", "fix"]);
});

test("dynamic workflow serializes nodes represented by the same agent", async () => {
  const workflow: Workflow = {
    nodes: [
      { id: "code-a", type: "coder" },
      { id: "code-b", type: "coder" },
    ],
    edges: [],
  };
  let activeCoders = 0;
  let peakCoders = 0;
  await runWorkflowDynamic(workflow, "task", () => {}, async () => {}, "anthropic", {
    maxConcurrency: 2,
    executeNode: async (node) => {
      activeCoders += 1;
      peakCoders = Math.max(peakCoders, activeCoders);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeCoders -= 1;
      return {
        text: node.id,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0,
        provider: "anthropic",
        model: "test",
      };
    },
  });
  assert.equal(peakCoders, 1);
});

test("dynamic workflow falls back from invalid concurrency and emits a terminal failure event", async () => {
  const events: SupervisorEvent[] = [];
  const workflow: Workflow = { nodes: [{ id: "plan", type: "planner" }], edges: [] };
  await assert.rejects(
    runWorkflowDynamic(workflow, "task", () => {}, async () => {}, "anthropic", {
      maxConcurrency: Number.NaN,
      supervisor: new OrbiPrimeSupervisor((event) => events.push(event)),
      executeNode: async () => { throw new Error("expected failure"); },
    }),
    /expected failure/
  );
  assert.equal(events.at(-1)?.type, "workflow-failed");
});
