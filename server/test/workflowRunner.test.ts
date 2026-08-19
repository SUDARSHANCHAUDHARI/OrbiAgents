import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflowInputs, runWorkflowDynamic, topoSort } from "../workflowRunner";
import { Workflow } from "../workflowTypes";
import { StreamResult } from "../ai";
import { OrbiPrimeSupervisor, SupervisorEvent } from "../supervisor";

function streamResult(text: string): StreamResult {
  return { text, inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, costUsd: 0, provider: "anthropic", model: "test" };
}

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

test("dynamic workflow aborts an in-flight runtime when the workflow is cancelled", async () => {
  const controller = new AbortController();
  let runtimeAborted = false;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const run = runWorkflowDynamic(
    { nodes: [{ id: "plan", type: "planner" }], edges: [] },
    "task",
    () => {},
    async () => {},
    "anthropic",
    {
      signal: controller.signal,
      executeNode: async (_node, _inputs, _onChunk, signal) => new Promise<StreamResult>((_resolve, reject) => {
        markStarted?.();
        signal.addEventListener("abort", () => {
          runtimeAborted = true;
          reject(new Error("aborted"));
        }, { once: true });
      }),
    }
  );
  await started;
  controller.abort();
  await assert.rejects(run, /aborted/);
  assert.equal(runtimeAborted, true);
});

test("local CLI workflow acquires and releases an isolated workspace per node", async () => {
  const leases: string[] = [];
  const releases: string[] = [];
  const workspaces: Array<string | undefined> = [];
  const workflow = { nodes: [{ id: "code", type: "coder" as const }], edges: [] };
  const result = await runWorkflowDynamic(workflow, "task", () => {}, async () => {}, "anthropic", {
    runId: "session-1",
    runtime: {
      id: "test-cli",
      kind: "local-cli",
      async isAvailable() { return true; },
      async execute() { throw new Error("unused"); },
    },
    workspaceIsolation: {
      async acquire(runId, agentId) {
        leases.push(`${runId}:${agentId}`);
        return { id: agentId, path: `/worktrees/${agentId}`, async release() { releases.push(agentId); return "preserved" as const; } };
      },
    },
    executeNode: async (_node, _inputs, _onChunk, _signal, workspacePath) => {
      workspaces.push(workspacePath);
      return streamResult("done");
    },
  });
  assert.equal(result.outputs.code, "done");
  assert.deepEqual(leases, ["session-1:code"]);
  assert.deepEqual(workspaces, ["/worktrees/code"]);
  assert.deepEqual(releases, ["code"]);
  assert.equal(result.steps[0].workspacePath, "/worktrees/code");
  assert.equal(result.steps[0].workspaceDisposition, "preserved");
});

test("local CLI workflow refuses to run without isolation", async () => {
  const workflow = { nodes: [{ id: "code", type: "coder" as const }], edges: [] };
  await assert.rejects(
    runWorkflowDynamic(workflow, "task", () => {}, async () => {}, "anthropic", {
      runtime: {
        id: "test-cli",
        kind: "local-cli",
        async isAvailable() { return true; },
        async execute() { return streamResult("unused"); },
      },
    }),
    /require workspace isolation/
  );
});
