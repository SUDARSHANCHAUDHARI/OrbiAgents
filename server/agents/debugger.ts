import { StreamResult, OnChunk, Provider, DEFAULT_PROVIDER } from "../ai";
import { apiRuntime, RuntimeAdapter } from "../runtimeAdapter";

const DEBUGGER_SYSTEM = `You are Orbi-Epsilon, a debugging specialist AI agent.
You receive code and a review, then produce a fixed version.
Output ONLY the corrected code — use a single \`\`\`typescript fenced block.
Apply every fix from the review. Do not add new features. No explanations outside the block.`;

export async function debuggerAgent(
  originalTask: string,
  code: string,
  review: string,
  onChunk: OnChunk,
  provider: Provider = DEFAULT_PROVIDER,
  runtime: RuntimeAdapter = apiRuntime
): Promise<StreamResult> {
  return runtime.execute({
    systemPrompt: DEBUGGER_SYSTEM,
    userMessage: `Original task: ${originalTask}\n\nOriginal code:\n${code}\n\nReview findings:\n${review}\n\nProvide fixed code:`,
    onChunk,
    provider,
  });
}
