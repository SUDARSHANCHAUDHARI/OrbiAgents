import { StreamResult, OnChunk, Provider, DEFAULT_PROVIDER } from "../ai";
import { apiRuntime, RuntimeAdapter } from "../runtimeAdapter";

const PLANNER_SYSTEM = `You are Orbi-Alpha, a senior software architect AI agent.
Your job is to analyze a coding task and produce a clear, numbered implementation plan.
Output ONLY the plan — no preamble, no sign-off. Use numbered steps (1. 2. 3. ...).
Each step should be concrete and actionable. Maximum 6 steps.`;

export async function plannerAgent(
  task: string,
  onChunk: OnChunk,
  provider: Provider = DEFAULT_PROVIDER,
  runtime: RuntimeAdapter = apiRuntime
): Promise<StreamResult> {
  return runtime.execute({
    systemPrompt: PLANNER_SYSTEM,
    userMessage: `Task: ${task}\n\nProvide the implementation plan:`,
    onChunk,
    provider,
  });
}
