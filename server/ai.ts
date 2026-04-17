import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type Provider = "anthropic" | "openai" | "gemini";

export const DEFAULT_PROVIDER: Provider =
  (process.env.DEFAULT_PROVIDER as Provider) ?? "anthropic";

// ── Models ────────────────────────────────────────────────────────────────────
const MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai:    "gpt-4o",
  gemini:    "gemini-2.0-flash",
};

// ── Pricing per token (USD) ───────────────────────────────────────────────────
const PRICING: Record<Provider, { input: number; output: number }> = {
  anthropic: { input: 3 / 1_000_000,    output: 15 / 1_000_000 },
  openai:    { input: 2.5 / 1_000_000,  output: 10 / 1_000_000 },
  gemini:    { input: 0.075 / 1_000_000, output: 0.3 / 1_000_000 },
};

// ── Lazy-init SDK clients ─────────────────────────────────────────────────────
let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;
let _gemini: GoogleGenerativeAI | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getGemini(): GoogleGenerativeAI {
  if (!_gemini) _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  return _gemini;
}

// ── Public types ──────────────────────────────────────────────────────────────
export interface StreamResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  provider: Provider;
  model: string;
}

export type OnChunk = (text: string) => void | Promise<void>;

// ── Provider implementations ──────────────────────────────────────────────────
async function streamAnthropic(
  systemPrompt: string,
  userMessage: string,
  onChunk: OnChunk
): Promise<StreamResult> {
  const client = getAnthropic();
  const model = MODELS.anthropic;
  let fullText = "";

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
      await onChunk(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const usage = final.usage as unknown as Record<string, number>;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreateTokens = usage.cache_creation_input_tokens ?? 0;
  const billable = inputTokens - cacheReadTokens - cacheCreateTokens;
  const p = PRICING.anthropic;
  const costUsd = billable * p.input + cacheReadTokens * 0.5 / 1_000_000 + outputTokens * p.output;

  return { text: fullText, inputTokens, outputTokens, cacheReadTokens, costUsd, provider: "anthropic", model };
}

async function streamOpenAI(
  systemPrompt: string,
  userMessage: string,
  onChunk: OnChunk
): Promise<StreamResult> {
  const client = getOpenAI();
  const model = MODELS.openai;
  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      await onChunk(delta);
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0;
      outputTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  const p = PRICING.openai;
  const costUsd = inputTokens * p.input + outputTokens * p.output;

  return { text: fullText, inputTokens, outputTokens, cacheReadTokens: 0, costUsd, provider: "openai", model };
}

async function streamGemini(
  systemPrompt: string,
  userMessage: string,
  onChunk: OnChunk
): Promise<StreamResult> {
  const ai = getGemini();
  const model = ai.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: systemPrompt,
  });

  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const result = await model.generateContentStream(userMessage);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullText += text;
      await onChunk(text);
    }
  }

  const finalResponse = await result.response;
  inputTokens = finalResponse.usageMetadata?.promptTokenCount ?? 0;
  outputTokens = finalResponse.usageMetadata?.candidatesTokenCount ?? 0;

  const p = PRICING.gemini;
  const costUsd = inputTokens * p.input + outputTokens * p.output;

  return { text: fullText, inputTokens, outputTokens, cacheReadTokens: 0, costUsd, provider: "gemini", model: MODELS.gemini };
}

// ── Unified entry point ───────────────────────────────────────────────────────
export async function streamMessage(
  systemPrompt: string,
  userMessage: string,
  onChunk: OnChunk,
  provider: Provider = DEFAULT_PROVIDER
): Promise<StreamResult> {
  switch (provider) {
    case "anthropic": return streamAnthropic(systemPrompt, userMessage, onChunk);
    case "openai":    return streamOpenAI(systemPrompt, userMessage, onChunk);
    case "gemini":    return streamGemini(systemPrompt, userMessage, onChunk);
  }
}

// ── Utility: list available providers (has API key set) ───────────────────────
export function availableProviders(): Provider[] {
  const all: Provider[] = ["anthropic", "openai", "gemini"];
  return all.filter(p => {
    if (p === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
    if (p === "openai")    return !!process.env.OPENAI_API_KEY;
    if (p === "gemini")    return !!process.env.GEMINI_API_KEY;
  });
}
