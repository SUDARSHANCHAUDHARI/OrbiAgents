import { StreamResult, OnChunk, Provider, DEFAULT_PROVIDER } from "../ai";
import { apiRuntime, RuntimeAdapter } from "../runtimeAdapter";

const CODER_SYSTEM = `You are Orbi-Beta, an expert software engineer AI agent.
You receive an implementation plan and write production-ready TypeScript code.
Output ONLY the code — use markdown fenced code blocks (e.g. \`\`\`typescript).
Be concise. No explanations outside the code blocks.`;

export async function coderAgent(
  originalTask: string,
  plan: string,
  onChunk: OnChunk,
  provider: Provider = DEFAULT_PROVIDER,
  runtime: RuntimeAdapter = apiRuntime
): Promise<StreamResult> {
  return runtime.execute({
    systemPrompt: CODER_SYSTEM,
    userMessage: `Original task: ${originalTask}\n\nImplementation plan:\n${plan}\n\nWrite the code:`,
    onChunk,
    provider,
  });
}
