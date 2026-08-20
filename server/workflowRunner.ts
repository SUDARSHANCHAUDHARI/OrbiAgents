import { plannerAgent } from "./agents/planner";
import { coderAgent } from "./agents/coder";
import { testerAgent } from "./agents/tester";
import { reviewerAgent } from "./agents/reviewer";
import { debuggerAgent } from "./agents/debugger";
import { Provider, StreamResult, DEFAULT_PROVIDER } from "./ai";
import { AgentUpdater, PauseWaiter } from "./orchestrator";
import { Workflow, WorkflowNode, NODE_AGENT_ID } from "./workflowTypes";
import { AgentState } from "./types";
import { WorkflowCircuitBreaker } from "./circuitBreaker";
import { apiRuntime, RuntimeAdapter } from "./runtimeAdapter";
import { OrbiPrimeSupervisor } from "./supervisor";
import { WorkspaceIsolation, WorkspaceLease } from "./workspaceIsolation";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

const NODE_ACTIVE_STATE: Record<string, AgentState> = {
  planner: "reading",
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
    workspacePath?: string;
    workspaceDisposition?: "removed" | "preserved";
  }>;
  totalCostUsd: number;
}

export type WorkflowNodeExecutor = (
  node: WorkflowNode,
  inputs: WorkflowInputs,
  onChunk: (chunk: string) => void | Promise<void>,
  signal: AbortSignal,
  workspacePath?: string
) => Promise<StreamResult>;

export interface WorkflowRunOptions {
  maxConcurrency?: number;
  nodeTimeoutMs?: number;
  runtime?: RuntimeAdapter;
  circuitBreaker?: WorkflowCircuitBreaker;
  supervisor?: OrbiPrimeSupervisor;
  executeNode?: WorkflowNodeExecutor;
  signal?: AbortSignal;
  workspaceIsolation?: WorkspaceIsolation;
  runId?: string;
  onWorkspacePreserved?: (input: { runId: string; nodeId: string; path: string }) => void | Promise<void>;
  getMemoryContext?: (node: WorkflowNode, agentId: string) => Promise<string>;
}

export async function runWorkflowDynamic(
  workflow: Workflow,
  task: string,
  update: AgentUpdater,
  waitIfPaused: PauseWaiter,
  provider: Provider = DEFAULT_PROVIDER,
  options: WorkflowRunOptions = {}
): Promise<WorkflowRunResult> {
  if (workflow.nodes.length === 0) throw new Error("Workflow has no nodes");

  const order = topoSort(workflow);
  const outputs = new Map<string, string>();
  const completedSteps = new Map<string, WorkflowRunResult["steps"][number]>();
  let totalCostUsd = 0;
  const requestedConcurrency = options.maxConcurrency ?? 3;
  const maxConcurrency = Number.isFinite(requestedConcurrency)
    ? Math.max(1, Math.min(Math.floor(requestedConcurrency), 10))
    : 3;
  const nodeTimeoutMs = options.nodeTimeoutMs ?? 5 * 60_000;
  const breaker = options.circuitBreaker ?? new WorkflowCircuitBreaker();
  const supervisor = options.supervisor ?? new OrbiPrimeSupervisor();
  const runtime = options.runtime ?? apiRuntime;
  const executor = options.executeNode ?? createDefaultExecutor(task, provider, runtime);
  if (runtime.kind === "local-cli" && !options.workspaceIsolation) {
    throw new Error("Local CLI workflows require workspace isolation");
  }
  const rank = new Map(order.map((node, index) => [node.id, index]));
  const remainingDependencies = new Map(
    workflow.nodes.map((node) => [
      node.id,
      workflow.edges.filter((edge) => edge.to === node.id).length,
    ])
  );
  const ready = order.filter((node) => remainingDependencies.get(node.id) === 0);
  const running = new Map<string, Promise<{ node: WorkflowNode; result: StreamResult }>>();
  const activeAgentIds = new Set<string>();

  supervisor.report("workflow-started", { detail: `${workflow.nodes.length} nodes` });

  const runNode = async (node: WorkflowNode): Promise<{ node: WorkflowNode; result: StreamResult }> => {
    const agentId = NODE_AGENT_ID[node.type];
    const label = node.label ?? node.type;
    const inputs = getWorkflowInputs(node.id, workflow.edges, outputs, workflow, task);
    const memoryContext = await options.getMemoryContext?.(node, agentId);
    if (memoryContext) inputs.combined = `${memoryContext}\n\nCurrent workflow input:\n${inputs.combined}`;
    const activeState = NODE_ACTIVE_STATE[node.type] ?? "thinking";

    breaker.check();
    await waitIfPaused(agentId);
    supervisor.report("node-started", { nodeId: node.id, detail: label });
    update(agentId, {
      state: activeState,
      task: `Running ${label}…`,
      lastAction: "Workflow step started",
      logs: [`${timestamp()} — [${activeState}] Executing ${label}`],
    });

    let buffer = "";
    let lastBroadcast = 0;
    let activeController: AbortController | null = null;

    const onChunk = async (chunk: string) => {
      try {
        await waitIfPaused(agentId);
      } catch (error) {
        activeController?.abort(error);
        throw error;
      }
      buffer += chunk;
      const now = Date.now();
      if (now - lastBroadcast > 500) {
        lastBroadcast = now;
        update(agentId, { task: buffer.slice(0, 80) + "…" });
      }
    };

    let result: StreamResult | undefined;
    let lastError: unknown;
    let lease: WorkspaceLease | undefined;
    let workspaceDisposition: "removed" | "preserved" | undefined;
    try {
      if (options.workspaceIsolation) {
        lease = await options.workspaceIsolation.acquire(options.runId ?? `run-${Date.now()}`, node.id);
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        const retry = breaker.recordRetry(node.id);
        supervisor.report("node-retrying", { nodeId: node.id, detail: `attempt ${retry + 1}` });
      }
      const controller = new AbortController();
      activeController = controller;
      const abortFromWorkflow = () => controller.abort(options.signal?.reason);
      if (options.signal?.aborted) abortFromWorkflow();
      else options.signal?.addEventListener("abort", abortFromWorkflow, { once: true });
      try {
        result = await withTimeout(executor(node, inputs, onChunk, controller.signal, lease?.path), nodeTimeoutMs, node.id, controller);
        break;
      } catch (error) {
        lastError = error;
        if (controller.signal.aborted || supervisor.selectRecovery(node.id, error, attempt) === "stop") break;
      } finally {
        options.signal?.removeEventListener("abort", abortFromWorkflow);
        activeController = null;
      }
      }
    } finally {
      workspaceDisposition = await lease?.release();
      if (workspaceDisposition === "preserved" && lease) {
        await options.onWorkspacePreserved?.({
          runId: options.runId ?? "unknown",
          nodeId: node.id,
          path: lease.path,
        });
      }
    }
    if (!result) {
      supervisor.report("node-failed", { nodeId: node.id, detail: errorMessage(lastError) });
      try {
        breaker.recordFailure();
      } catch (circuitError) {
        supervisor.report("circuit-opened", { nodeId: node.id, detail: errorMessage(circuitError) });
        throw circuitError;
      }
      throw lastError instanceof Error ? lastError : new Error("Workflow node failed");
    }

    outputs.set(node.id, result.text);
    completedSteps.set(node.id, {
      nodeId: node.id,
      type: node.type,
      label,
      output: result.text,
      ...(workspaceDisposition === "preserved" && lease
        ? { workspacePath: lease.path, workspaceDisposition }
        : workspaceDisposition ? { workspaceDisposition } : {}),
    });
    totalCostUsd += result.costUsd;
    try {
      breaker.recordSuccess(result.inputTokens, result.outputTokens, result.costUsd);
    } catch (error) {
      supervisor.report("circuit-opened", { nodeId: node.id, detail: errorMessage(error) });
      throw error;
    }
    supervisor.report("node-completed", { nodeId: node.id, detail: label });

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
    return { node, result };
  };

  while (ready.length > 0 || running.size > 0) {
    ready.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    while (ready.length > 0 && running.size < maxConcurrency) {
      const readyIndex = ready.findIndex((node) => !activeAgentIds.has(NODE_AGENT_ID[node.type]));
      if (readyIndex === -1) break;
      const [node] = ready.splice(readyIndex, 1);
      supervisor.report("node-ready", { nodeId: node.id });
      activeAgentIds.add(NODE_AGENT_ID[node.type]);
      running.set(node.id, runNode(node));
    }

    let finished: { node: WorkflowNode; result: StreamResult };
    try {
      finished = await Promise.race(running.values());
    } catch (error) {
      await Promise.allSettled(running.values());
      supervisor.report("workflow-failed", { detail: errorMessage(error) });
      throw error;
    }
    running.delete(finished.node.id);
    activeAgentIds.delete(NODE_AGENT_ID[finished.node.type]);
    for (const edge of workflow.edges) {
      if (edge.from !== finished.node.id) continue;
      const remaining = (remainingDependencies.get(edge.to) ?? 1) - 1;
      remainingDependencies.set(edge.to, remaining);
      if (remaining === 0) {
        const successor = workflow.nodes.find((node) => node.id === edge.to);
        if (successor) ready.push(successor);
      }
    }
  }

  supervisor.report("workflow-completed", { detail: `${completedSteps.size} nodes` });
  const steps = order.map((node) => completedSteps.get(node.id)!);
  return { outputs: Object.fromEntries(outputs), steps, totalCostUsd };
}

function createDefaultExecutor(
  task: string,
  provider: Provider,
  runtime: RuntimeAdapter
): WorkflowNodeExecutor {
  return async (node, inputs, onChunk, signal, workspacePath) => {
    const scopedRuntime: RuntimeAdapter = workspacePath
      ? {
          id: runtime.id,
          kind: runtime.kind,
          isAvailable: () => runtime.isAvailable(),
          execute: (request) => runtime.execute({ ...request, workspacePath }),
        }
      : runtime;
    switch (node.type) {
      case "planner": return plannerAgent(inputs.combined, onChunk, provider, scopedRuntime, signal);
      case "coder": return coderAgent(task, inputs.combined, onChunk, provider, scopedRuntime, signal);
      case "tester": return testerAgent(task, inputs.latestCode ?? inputs.combined, onChunk, provider, scopedRuntime, signal);
      case "reviewer": return reviewerAgent(task, inputs.latestCode ?? inputs.combined, onChunk, provider, scopedRuntime, signal);
      case "debugger": return debuggerAgent(
        task,
        inputs.latestCode ?? inputs.combined,
        inputs.latestReview ?? inputs.combined,
        onChunk,
        provider,
        scopedRuntime,
        signal
      );
    }
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  nodeId: string,
  controller: AbortController
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(new NodeTimeoutError(nodeId));
          reject(new NodeTimeoutError(nodeId));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class NodeTimeoutError extends Error {
  constructor(nodeId: string) {
    super(`Node ${nodeId} timed out`);
    this.name = "NodeTimeoutError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
