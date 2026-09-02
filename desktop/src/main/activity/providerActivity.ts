import type { ActivitySource, AgentActivityState, ProviderUsage } from "../../shared/contracts";

export interface NormalizedProviderActivity {
  source: Extract<ActivitySource, "claude-hook" | "claude-transcript" | "codex-jsonl">;
  state: AgentActivityState;
  summary: string;
  sessionId?: string;
  cwd?: string;
  usage?: ProviderUsage;
}

const CLAUDE_READING_TOOLS = new Set(["Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "ToolSearch"]);
const CLAUDE_THINKING_TOOLS = new Set(["Skill", "Agent", "TodoWrite"]);
const CLAUDE_CODING_TOOLS = new Set(["Write", "Edit", "Bash", "NotebookEdit"]);

function claudeToolState(toolName: unknown): AgentActivityState {
  if (typeof toolName !== "string") return "thinking";
  if (CLAUDE_READING_TOOLS.has(toolName)) return "reading";
  if (CLAUDE_THINKING_TOOLS.has(toolName)) return "thinking";
  if (CLAUDE_CODING_TOOLS.has(toolName) || toolName.startsWith("mcp__")) return "coding";
  return "thinking";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function providerUsage(value: unknown, scope: ProviderUsage["scope"], costValue?: unknown): ProviderUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  const cachedInputTokens = tokenCount(usage.cached_input_tokens ?? usage.cache_read_input_tokens);
  const costUsd = finiteCost(costValue);
  return { scope, inputTokens, outputTokens, ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }), ...(costUsd === undefined ? {} : { costUsd }) };
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000_000 ? value : undefined;
}

function finiteCost(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? value : undefined;
}

export function normalizeClaudeHook(payload: unknown): NormalizedProviderActivity | null {
  if (!payload || typeof payload !== "object") return null;
  const event = payload as Record<string, unknown>;
  const hookEvent = optionalString(event.hook_event_name);
  if (!hookEvent) return null;

  let state: AgentActivityState | null = null;
  if (hookEvent === "PreToolUse") state = claudeToolState(event.tool_name);
  else if (hookEvent === "Stop" || hookEvent === "SessionEnd") state = "idle";
  else if (hookEvent === "PermissionRequest") state = "permission-waiting";
  else if (hookEvent === "SubagentStart") state = "coding";
  else if (["UserPromptSubmit", "SessionStart", "SubagentStop"].includes(hookEvent)) state = "thinking";
  else if (hookEvent === "Notification") state = event.notification_type === "idle_prompt" ? "idle" : "thinking";
  if (!state) return null;

  return {
    source: "claude-hook",
    state,
    summary: `Claude ${hookEvent}`,
    sessionId: optionalString(event.session_id),
    cwd: optionalString(event.cwd),
  };
}

export function normalizeClaudeTranscriptLine(raw: string): NormalizedProviderActivity | null {
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  const type = optionalString(event.type);
  let state: AgentActivityState | null = null;
  let usage: ProviderUsage | undefined;
  if (type === "assistant") {
    const message = event.message as Record<string, unknown> | undefined;
    const content = Array.isArray(message?.content) ? message.content : [];
    const toolUse = content.find((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "tool_use") as Record<string, unknown> | undefined;
    state = toolUse ? claudeToolState(toolUse.name) : "thinking";
    usage = providerUsage(message?.usage, "event");
  } else if (type === "result") {
    state = event.is_error === true ? "failed" : "done";
    usage = providerUsage(event.usage, "event", event.total_cost_usd);
  } else if (type === "system" && event.subtype === "turn_duration") state = "idle";
  else if (type === "progress") state = event.data && typeof event.data === "object" && (event.data as Record<string, unknown>).type === "agent_progress" ? "thinking" : "coding";
  if (!state) return null;
  return { source: "claude-transcript", state, summary: `Claude transcript ${type}`, sessionId: optionalString(event.sessionId) ?? optionalString(event.session_id), ...(usage ? { usage } : {}) };
}

export function normalizeCodexJsonLine(raw: string): NormalizedProviderActivity | null {
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  const type = optionalString(event.type);
  if (!type) return null;
  let state: AgentActivityState | null = null;
  let summary = `Codex ${type}`;
  if (type === "thread.started" || type === "turn.started") state = "thinking";
  else if (type === "turn.completed") state = "done";
  else if (type === "turn.failed" || type === "error") state = "failed";
  else if (type === "item.started" || type === "item.updated") {
    const item = event.item as Record<string, unknown> | undefined;
    const itemType = optionalString(item?.type);
    if (!itemType) return null;
    summary = `Codex ${itemType.replaceAll("_", " ")}`;
    if (["command_execution", "file_change", "mcp_tool_call", "collab_tool_call"].includes(itemType)) state = "coding";
    else if (itemType === "web_search") state = "reading";
    else if (["reasoning", "agent_message", "todo_list"].includes(itemType)) state = "thinking";
  }
  if (!state) return null;
  const usage = providerUsage(event.usage, "event");
  return { source: "codex-jsonl", state, summary, sessionId: optionalString(event.thread_id), ...(usage ? { usage } : {}) };
}

export function normalizeCodexRolloutLine(raw: string): NormalizedProviderActivity | null {
  let record: Record<string, unknown>;
  try { record = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  const payload = record.payload as Record<string, unknown> | undefined;
  const payloadType = optionalString(payload?.type);
  let state: AgentActivityState | null = null;
  let usage: ProviderUsage | undefined;
  if (record.type === "event_msg") {
    if (payloadType === "task_started") state = "thinking";
    else if (payloadType === "task_complete") state = "done";
    else if (payloadType === "error" || payloadType === "stream_error") state = "failed";
    else if (payloadType === "agent_message") state = "thinking";
    else if (payloadType === "token_count") {
      const info = payload?.info as Record<string, unknown> | undefined;
      usage = providerUsage(info?.total_token_usage, "session-total");
      if (usage) state = "thinking";
    }
  } else if (record.type === "response_item") {
    if (["function_call", "custom_tool_call", "local_shell_call", "mcp_tool_call"].includes(payloadType ?? "")) state = "coding";
    else if (payloadType === "web_search_call") state = "reading";
    else if (payloadType === "reasoning") state = "thinking";
  }
  if (!state) return null;
  return { source: "codex-jsonl", state, summary: `Codex ${payloadType?.replaceAll("_", " ") ?? "activity"}`, ...(usage ? { usage } : {}) };
}

export function codexRolloutSession(raw: string): { sessionId: string; cwd: string } | null {
  let record: Record<string, unknown>;
  try { record = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  if (record.type !== "session_meta" || !record.payload || typeof record.payload !== "object") return null;
  const payload = record.payload as Record<string, unknown>;
  const sessionId = optionalString(payload.session_id) ?? optionalString(payload.id);
  const cwd = optionalString(payload.cwd);
  return sessionId && cwd ? { sessionId, cwd } : null;
}
