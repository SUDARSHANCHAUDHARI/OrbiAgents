// "done" is not emitted here — reserved for future task completion signals.
// Idle transitions are handled by the inactivity timer in transcriptWatcher.ts.
export type AgentState = "idle" | "thinking" | "coding" | "done";

// Maps tool name → agent state
const TOOL_STATE_MAP: Record<string, AgentState> = {
  // Reading/exploring → thinking
  Read:      "thinking",
  Grep:      "thinking",
  Glob:      "thinking",
  LS:        "thinking",
  WebFetch:  "thinking",
  WebSearch: "thinking",
  Skill:     "thinking",
  ToolSearch:"thinking",
  // Writing/running → coding
  Write:       "coding",
  Edit:        "coding",
  Bash:        "coding",
  NotebookEdit:"coding",
  // Agent delegation + task tracking → thinking
  Agent:     "thinking",
  TodoWrite: "thinking",
};

export function toolCallToState(toolName: string): AgentState {
  if (TOOL_STATE_MAP[toolName]) return TOOL_STATE_MAP[toolName];
  // MCP tools (mcp__server__tool) are side-effectful actions → coding
  if (toolName.startsWith("mcp__")) return "coding";
  return "thinking";
}

// A line of JSONL from a Claude Code transcript
export interface TranscriptLine {
  type: string;
  message?: {
    content?: Array<{ type: string; name?: string }>;
  };
}

// Returns the agent state derived from a transcript line, or null if irrelevant
export function parseTranscriptLine(raw: string): AgentState | null {
  try {
    const line = JSON.parse(raw) as TranscriptLine;
    if (line.type !== "assistant") return null;
    const content = line.message?.content ?? [];
    for (const block of content) {
      if (block.type === "tool_use" && block.name) {
        return toolCallToState(block.name);
      }
    }
    // Assistant text message with no tool use = thinking
    if (content.some(b => b.type === "text")) return "thinking";
    return null;
  } catch {
    return null;
  }
}
