// "done" is not emitted here — reserved for future task completion signals.
// Idle transitions are handled by the inactivity timer in transcriptWatcher.ts.
export type AgentState = "idle" | "thinking" | "reading" | "coding" | "permission-waiting" | "done";

// Maps tool name → agent state
const TOOL_STATE_MAP: Record<string, AgentState> = {
  // Reading/exploring → reading
  Read:      "reading",
  Grep:      "reading",
  Glob:      "reading",
  LS:        "reading",
  WebFetch:  "reading",
  WebSearch: "reading",
  Skill:     "thinking",
  ToolSearch:"reading",
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

// Exempt tools complete without user approval — no permission timer needed.
// Non-exempt tools (Write/Edit/Bash/MCP/NotebookEdit) may trigger a permission prompt.
const EXEMPT_TOOLS = new Set([
  "Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch",
  "Skill", "ToolSearch", "Agent", "TodoWrite",
]);

export function isExemptTool(toolName: string): boolean {
  return EXEMPT_TOOLS.has(toolName);
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

/**
 * Map a Claude Code hook event to an AgentState.
 *
 * @param eventName  - hook_event_name field (e.g. "PreToolUse", "Stop")
 * @param toolName   - tool_name field, only present for PreToolUse events
 * @param notifType  - notification_type field, only present for Notification events
 * @returns AgentState, or null if the event does not trigger a state change
 */
export function hookEventToState(
  eventName: string,
  toolName?: string,
  notifType?: string,
): AgentState | null {
  switch (eventName) {
    case "PreToolUse":
      // Reuse same tool→state logic as the JSONL path
      return toolName ? toolCallToState(toolName) : "thinking";
    case "Stop":
    case "SessionEnd":
      return "idle";
    case "Notification":
      // idle_prompt means Claude finished and is waiting for user input
      return notifType === "idle_prompt" ? "idle" : "thinking";
    case "PermissionRequest":
      return "permission-waiting";
    case "UserPromptSubmit":
    case "SessionStart":
    case "SubagentStop":
      return "thinking";
    case "SubagentStart":
      return "coding";
    case "PostToolUse":
    case "PostToolUseFailure":
      // Stop hook handles the idle transition — these don't trigger a state change
      return null;
    default:
      return null;
  }
}
