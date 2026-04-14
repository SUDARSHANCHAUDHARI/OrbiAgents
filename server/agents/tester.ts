import { streamMessage, StreamResult, OnChunk } from "../ai";

const TESTER_SYSTEM = `You are Orbi-Gamma, a meticulous QA engineer AI agent.
You receive code and write comprehensive tests for it using Vitest.
Output ONLY the test file — use a single \`\`\`typescript fenced block.
Cover: happy path, edge cases, error cases. No explanations.`;

export async function testerAgent(
  originalTask: string,
  code: string,
  onChunk: OnChunk
): Promise<StreamResult> {
  return streamMessage(
    TESTER_SYSTEM,
    `Original task: ${originalTask}\n\nCode to test:\n${code}\n\nWrite comprehensive tests:`,
    onChunk
  );
}
