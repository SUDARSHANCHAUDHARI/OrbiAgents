import { plannerAgent } from "./agents/planner";
import { coderAgent } from "./agents/coder";
import { testerAgent } from "./agents/tester";
import { reviewerAgent } from "./agents/reviewer";
import { debuggerAgent } from "./agents/debugger";
import { Provider, StreamResult, DEFAULT_PROVIDER } from "./ai";
import { AgentUpdater, PauseWaiter } from "./orchestrator";
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

export function topoSort(workflow: Workflow): WorkflowNode[] {
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

export interface WorkflowInputs {
  combined: string;
  latestCode: string | null;
  latestReview: string | null;
}

export function getWorkflowInputs(
  nodeId: string,
  edges: Workflow["edges"],
  outputs: Map<string, string>,
  workflow: Workflow,
  task: string
): WorkflowInputs {
  const predecessors = edges
    .filter((edge) => edge.to === nodeId)
    .map((edge) => workflow.nodes.find((node) => node.id === edge.from))
    .filter((node): node is WorkflowNode => node != null);

  if (predecessors.length === 0) {
    return { combined: task, latestCode: null, latestReview: null };
  }

  let latestCode: string | null = null;
  let latestReview: string | null = null;

  for (const node of predecessors) {
    const output = outputs.get(node.id);
    if (!output) continue;
    if (node.type === "coder" || node.type === "debugger") latestCode = output;
    if (node.type === "reviewer") latestReview = output;
  }

  return {
    combined: predecessors.map((node) => outputs.get(node.id) ?? "").join("\n\n"),
    latestCode,
    latestReview,
  };
}

export interface WorkflowRunResult {
  outputs: Record<string, string>;
  steps: Array<{
    nodeId: string;
    type: WorkflowNode["type"];
    label: string;
    output: string;
  }>;
  totalCostUsd: number;
}

export async function runWorkflowDynamic(
  workflow: Workflow,
  task: string,
  update: AgentUpdater,
  waitIfPaused: PauseWaiter,
  provider: Provider = DEFAULT_PROVIDER
): Promise<WorkflowRunResult> {
  if (workflow.nodes.length === 0) throw new Error("Workflow has no nodes");

  const order = topoSort(workflow);
  const outputs = new Map<string, string>();
  const steps: WorkflowRunResult["steps"] = [];
  let totalCostUsd = 0;

  for (const node of order) {
    const agentId = NODE_AGENT_ID[node.type];
    const label = node.label ?? node.type;
    const inputs = getWorkflowInputs(node.id, workflow.edges, outputs, workflow, task);
    const activeState = NODE_ACTIVE_STATE[node.type] ?? "thinking";

    await waitIfPaused(agentId);
    update(agentId, {
      state: activeState,
      task: `Running ${label}…`,
      lastAction: "Workflow step started",
      logs: [`${timestamp()} — [${activeState}] Executing ${label}`],
    });

    let buffer = "";
    let lastBroadcast = 0;

    const onChunk = async (chunk: string) => {
      await waitIfPaused(agentId);
      buffer += chunk;
      const now = Date.now();
      if (now - lastBroadcast > 500) {
        lastBroadcast = now;
        update(agentId, { task: buffer.slice(0, 80) + "…" });
      }
    };

    let result: StreamResult;

    switch (node.type) {
      case "planner":
        result = await plannerAgent(inputs.combined, onChunk, provider);
        break;
      case "coder":
        result = await coderAgent(task, inputs.combined, onChunk, provider);
        break;
      case "tester":
        result = await testerAgent(task, inputs.latestCode ?? inputs.combined, onChunk, provider);
        break;
      case "reviewer":
        result = await reviewerAgent(task, inputs.latestCode ?? inputs.combined, onChunk, provider);
        break;
      case "debugger":
        result = await debuggerAgent(
          task,
          inputs.latestCode ?? inputs.combined,
          inputs.latestReview ?? inputs.combined,
          onChunk,
          provider
        );
        break;
    }

    outputs.set(node.id, result.text);
    steps.push({ nodeId: node.id, type: node.type, label, output: result.text });
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

  return { outputs: Object.fromEntries(outputs), steps, totalCostUsd };
}
