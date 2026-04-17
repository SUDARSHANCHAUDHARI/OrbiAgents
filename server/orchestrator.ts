import { plannerAgent } from "./agents/planner";
import { coderAgent } from "./agents/coder";
import { Provider, DEFAULT_PROVIDER } from "./ai";
import { Agent } from "./types";

export interface WorkflowResult {
  plan: string;
  code: string;
  totalCostUsd: number;
}

export type AgentUpdater = (id: string, patch: Partial<Agent>) => void;
export type PauseWaiter = (id: string) => Promise<void>;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export async function runWorkflow(
  task: string,
  update: AgentUpdater,
  waitIfPaused: PauseWaiter,
  provider: Provider = DEFAULT_PROVIDER
): Promise<WorkflowResult> {
  // ── Phase 1: Planner (Orbi-Alpha) ──────────────────────────────
  update("1", {
    state: "thinking",
    task: "Planning architecture…",
    lastAction: "Analyzing task",
    logs: [`${timestamp()} — [thinking] Starting plan for: ${task}`],
  });

  let planBuffer = "";
  let lastPlanBroadcast = 0;

  const planResult = await plannerAgent(task, async (chunk) => {
    await waitIfPaused("1");
    planBuffer += chunk;
    const now = Date.now();
    if (now - lastPlanBroadcast > 500) {
      lastPlanBroadcast = now;
      update("1", { task: planBuffer.slice(0, 80) + "…" });
    }
  }, provider);

  update("1", {
    state: "done",
    task: "Plan complete",
    lastAction: `Wrote ${planResult.text.split("\n").length}-step plan`,
    inputTokens: planResult.inputTokens,
    outputTokens: planResult.outputTokens,
    tokensUsed: planResult.inputTokens + planResult.outputTokens,
    costUsd: planResult.costUsd,
    logs: [`${timestamp()} — [done] Plan complete — $${planResult.costUsd.toFixed(4)}`],
  });

  // ── Phase 2: Coder (Orbi-Beta) ─────────────────────────────────
  await waitIfPaused("2");
  update("2", {
    state: "thinking",
    task: "Reading plan from Orbi-Alpha…",
    lastAction: "Received handoff",
    logs: [`${timestamp()} — [thinking] Received plan, starting code`],
  });

  let codeBuffer = "";
  let lastCodeBroadcast = 0;

  const codeResult = await coderAgent(task, planResult.text, async (chunk) => {
    await waitIfPaused("2");
    codeBuffer += chunk;
    const now = Date.now();
    if (now - lastCodeBroadcast > 500) {
      lastCodeBroadcast = now;
      const lines = codeBuffer.split("\n").length;
      update("2", {
        state: "coding",
        task: `Writing code… (${lines} lines)`,
        lastAction: `Wrote ${lines} lines`,
      });
    }
  }, provider);

  const lineCount = codeResult.text.split("\n").length;
  update("2", {
    state: "done",
    task: "Code complete",
    lastAction: `Delivered ${lineCount} lines`,
    inputTokens: codeResult.inputTokens,
    outputTokens: codeResult.outputTokens,
    tokensUsed: codeResult.inputTokens + codeResult.outputTokens,
    costUsd: codeResult.costUsd,
    logs: [`${timestamp()} — [done] Code complete — $${codeResult.costUsd.toFixed(4)}`],
  });

  return {
    plan: planResult.text,
    code: codeResult.text,
    totalCostUsd: planResult.costUsd + codeResult.costUsd,
  };
}
