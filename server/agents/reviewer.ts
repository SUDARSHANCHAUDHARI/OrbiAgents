import { streamMessage, StreamResult, OnChunk, Provider, DEFAULT_PROVIDER } from "../ai";

const REVIEWER_SYSTEM = `You are Orbi-Delta, a senior code reviewer AI agent.
You review code for correctness, security vulnerabilities, and best practices.
Output a structured review with sections: ## Summary, ## Issues (numbered), ## Suggestions.
Be specific. Reference line numbers where possible.`;

export async function reviewerAgent(
  originalTask: string,
  code: string,
  onChunk: OnChunk,
  provider: Provider = DEFAULT_PROVIDER
): Promise<StreamResult> {
  return streamMessage(
    REVIEWER_SYSTEM,
    `Original task: ${originalTask}\n\nCode to review:\n${code}\n\nProvide your review:`,
    onChunk,
    provider
  );
}
