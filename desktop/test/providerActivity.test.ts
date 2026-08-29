import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codexRolloutSession, normalizeClaudeHook, normalizeClaudeTranscriptLine, normalizeCodexJsonLine, normalizeCodexRolloutLine } from "../src/main/activity/providerActivity";

describe("provider activity normalization", () => {
  it("maps Claude hooks without retaining prompt or tool input", () => {
    assert.deepEqual(normalizeClaudeHook({ hook_event_name: "PreToolUse", tool_name: "Read", session_id: "s1", cwd: "/repo", tool_input: { file_path: "/secret" } }), {
      source: "claude-hook", state: "reading", summary: "Claude PreToolUse", sessionId: "s1", cwd: "/repo",
    });
    assert.equal(normalizeClaudeHook({ hook_event_name: "PermissionRequest" })?.state, "permission-waiting");
    assert.equal(normalizeClaudeHook({ hook_event_name: "PostToolUse" }), null);
  });

  it("maps Claude transcript facts and ignores content", () => {
    assert.deepEqual(normalizeClaudeTranscriptLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { content: "private" } }] } })), {
      source: "claude-transcript", state: "coding", summary: "Claude transcript assistant", sessionId: undefined,
    });
    assert.equal(normalizeClaudeTranscriptLine("not json"), null);
  });

  it("maps official Codex JSONL event types without retaining event text", () => {
    assert.deepEqual(normalizeCodexJsonLine(JSON.stringify({ type: "item.started", item: { id: "item_0", type: "command_execution", command: "cat .env" } })), {
      source: "codex-jsonl", state: "coding", summary: "Codex command execution", sessionId: undefined,
    });
    assert.equal(normalizeCodexJsonLine('{"type":"turn.completed","usage":{"input_tokens":1}}')?.state, "done");
    assert.equal(normalizeCodexJsonLine('{"type":"error","message":"secret"}')?.state, "failed");
    assert.equal(normalizeCodexJsonLine("broken"), null);
  });

  it("maps the installed Codex rollout schema and extracts only session identity", () => {
    assert.deepEqual(codexRolloutSession(JSON.stringify({ type: "session_meta", payload: { session_id: "thread-1", cwd: "/repo", base_instructions: "private" } })), { sessionId: "thread-1", cwd: "/repo" });
    assert.deepEqual(normalizeCodexRolloutLine(JSON.stringify({ type: "event_msg", payload: { type: "task_started", private: "text" } })), {
      source: "codex-jsonl", state: "thinking", summary: "Codex task started",
    });
    assert.equal(normalizeCodexRolloutLine(JSON.stringify({ type: "response_item", payload: { type: "function_call", arguments: "private" } }))?.state, "coding");
    assert.equal(normalizeCodexRolloutLine(JSON.stringify({ type: "event_msg", payload: { type: "task_complete", last_agent_message: "private" } }))?.state, "done");
  });
});
