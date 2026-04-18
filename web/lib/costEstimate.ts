import { Provider } from "./types";

// Rough chars-per-token ratio for English text
const CHARS_PER_TOKEN = 4;

// Per-million-token pricing (matches server/ai.ts)
const PRICING: Record<Provider, { input: number; output: number }> = {
  anthropic: { input: 3 / 1_000_000,    output: 15 / 1_000_000 },
  openai:    { input: 2.5 / 1_000_000,  output: 10 / 1_000_000 },
  gemini:    { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
};

// Typical system-prompt + overhead tokens per agent
const SYSTEM_TOKENS_PER_AGENT = 800;
// Estimated output tokens per agent
const OUTPUT_TOKENS_PER_AGENT = 1200;
// Default number of agents in a quick run
const QUICK_RUN_AGENTS = 2;

export function estimateRunCost(task: string, provider: Provider, agentCount = QUICK_RUN_AGENTS): number {
  const taskTokens = Math.ceil(task.length / CHARS_PER_TOKEN);
  const inputPerAgent = SYSTEM_TOKENS_PER_AGENT + taskTokens;
  const p = PRICING[provider];
  return agentCount * (inputPerAgent * p.input + OUTPUT_TOKENS_PER_AGENT * p.output);
}

export function formatEstimate(cost: number): string {
  if (cost < 0.0001) return "< $0.0001";
  if (cost < 0.01) return `~$${cost.toFixed(4)}`;
  return `~$${cost.toFixed(3)}`;
}
