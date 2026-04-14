import Anthropic from "@anthropic-ai/sdk";

export const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-opus-4-6";

// Pricing per token (USD)
const PRICE_INPUT = 5 / 1_000_000;       // $5 per 1M input tokens
const PRICE_OUTPUT = 25 / 1_000_000;     // $25 per 1M output tokens
const PRICE_CACHE_READ = 0.5 / 1_000_000; // $0.50 per 1M cache-read tokens

export interface StreamResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export type OnChunk = (text: string) => void;

/**
 * Stream a Claude response. Calls onChunk for each text delta.
 * Returns the full text plus accurate token usage and USD cost.
 */
export async function streamMessage(
  systemPrompt: string,
  userMessage: string,
  onChunk: OnChunk
): Promise<StreamResult> {
  let fullText = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const usage = final.usage;

  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const usageExtra = usage as unknown as Record<string, number>;
  const cacheReadTokens = usageExtra.cache_read_input_tokens ?? 0;
  const cacheCreateTokens = usageExtra.cache_creation_input_tokens ?? 0;
  const billableInput = inputTokens - cacheReadTokens - cacheCreateTokens;

  const costUsd =
    billableInput * PRICE_INPUT +
    cacheReadTokens * PRICE_CACHE_READ +
    outputTokens * PRICE_OUTPUT;

  return { text: fullText, inputTokens, outputTokens, cacheReadTokens, costUsd };
}
