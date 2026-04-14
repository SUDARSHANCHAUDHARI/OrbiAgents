import { plannerAgent } from "./agents/planner";
import { coderAgent } from "./agents/coder";
import { testerAgent } from "./agents/tester";
import { reviewerAgent } from "./agents/reviewer";
import { debuggerAgent } from "./agents/debugger";
import { StreamResult } from "./ai";
import { AgentUpdater } from "./orchestrator";
import { Workflow, WorkflowNode, NODE_AGENT_ID } from "./workflowTypes";
import { AgentState } from "./types";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

const NODE_ACTIVE_STATE: Record<string, AgentState> = {
  planner: "thinking",
  coder: "coding",
  tester: "testing",
  reviewer: "reviewing",
  debugger: "debugging",
};

function topoSort(workflow: Workflow): WorkflowNode[] {
  const inDegree = new Map<string, number>(
    workflow.nodes.map((n) => [n.id, 0])
  );
  for (const edge of workflow.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  const queue = workflow.nodes.filter((n) => inDegree.get(n.id) === 0);
  const order: WorkflowNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const edge of workflow.edges) {
      if (edge.from !== node.id) continue;
      const newDeg = (inDegree.get(edge.to) ?? 1) - 1;
      inDegree.set(edge.to, newDeg);
      if (newDeg === 0) {
        const next = workflow.nodes.find((n) => n.id === edge.to);
        if (next) queue.push(next);
      }
    }
  }
  if (order.length !== workflow.nodes.length) {
    throw new Error("Workflow contains a cycle");
  }
  return order;
}

function getPredOutput(
  nodeId: string,
  edges: Workflow["edges"],
  outputs: Map<string, string>,
  task: string
): string {
  const predIds = edges.filter((e) => e.to === nodeId).map((e) => e.from);
  if (predIds.length === 0) return task;
  return predIds.map((id) => outputs.get(id) ?? "").join("\n\n");
}

export interface WorkflowRunResult {
  outputs: Record<string, string>;
  totalCostUsd: number;
}

export async function runWorkflowDynamic(
  workflow: Workflow,
  task: string,
  update: AgentUpdater
): Promise<WorkflowRunResult> {
  if (workflow.nodes.length === 0) throw new Error("Workflow has no nodes");

  const order = topoSort(workflow);
  const outputs = new Map<string, string>();
  let totalCostUsd = 0;

  for (const node of order) {
    const agentId = NODE_AGENT_ID[node.type];
    const label = node.label ?? node.type;
    const predecessorOutput = getPredOutput(node.id, workflow.edges, outputs, task);
    const activeState = NODE_ACTIVE_STATE[node.type] ?? "thinking";

    update(agentId, {
      state: activeState,
      task: `Running ${label}…`,
      lastAction: "Workflow step started",
      logs: [`${timestamp()} — [${activeState}] Executing ${label}`],
    });

    let buffer = "";
    let lastBroadcast = 0;

    const onChunk = (chunk: string) => {
      buffer += chunk;
      const now = Date.now();
      if (now - lastBroadcast > 500) {
        lastBroadcast = now;
        update(agentId, { task: buffer.slice(0, 80) + "…" });
      }
    };

    let result: StreamResult;

    // For coder/tester/reviewer/debugger, find the most recent code output
    const lastCode = [...outputs.values()].pop() ?? task;

    switch (node.type) {
      case "planner":
        result = await plannerAgent(predecessorOutput, onChunk);
        break;
      case "coder":
        result = await coderAgent(task, predecessorOutput, onChunk);
        break;
      case "tester":
        result = await testerAgent(task, lastCode, onChunk);
        break;
      case "reviewer":
        result = await reviewerAgent(task, lastCode, onChunk);
        break;
      case "debugger": {
        // Needs code (second-to-last) and review (last)
        const vals = [...outputs.values()];
        const code = vals.length >= 2 ? vals[vals.length - 2] : lastCode;
        const review = vals[vals.length - 1] ?? "";
        result = await debuggerAgent(task, code, review, onChunk);
        break;
      }
    }

    outputs.set(node.id, result.text);
    totalCostUsd += result.costUsd;

    update(agentId, {
      state: "done",
      task: `${label} complete`,
      lastAction: `Finished ${label}`,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      tokensUsed: result.inputTokens + result.outputTokens,
      costUsd: result.costUsd,
      logs: [`${timestamp()} — [done] ${label} — $${result.costUsd.toFixed(4)}`],
    });
  }

  return { outputs: Object.fromEntries(outputs), totalCostUsd };
}
