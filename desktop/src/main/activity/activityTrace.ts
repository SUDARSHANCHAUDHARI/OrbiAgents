import { createHash } from "node:crypto";
import type { ActivityEvent } from "../../shared/contracts";

const MAX_EVENTS = 500;
const TYPES = new Set(["session-starting", "session-started", "terminal-output", "provider-activity", "session-stopping", "session-exited", "session-failed", "workspace-preserved", "workspace-applied", "workspace-cleaned", "circuit-steered", "circuit-constrained", "circuit-opened"]);
const SOURCES = new Set(["lifecycle", "terminal", "claude-hook", "claude-transcript", "codex-jsonl"]);
const STATES = new Set(["idle", "thinking", "reading", "coding", "permission-waiting", "done", "failed"]);

export function activityTraceJson(input: unknown): string {
  if (!Array.isArray(input) || input.length > MAX_EVENTS) throw new Error("Activity trace is invalid");
  const events = input.map(validateEvent).sort((left, right) => left.timestamp - right.timestamp);
  const byAgent = new Map<string, ActivityEvent[]>();
  for (const event of events) byAgent.set(event.agentId, [...(byAgent.get(event.agentId) ?? []), event]);
  const scopeSpans = [...byAgent].map(([agentId, agentEvents]) => ({ scope: { name: "OrbiAgents.desktop", version: "1" }, spans: agentEvents.map((event, index) => ({ traceId: hex(`${agentId}:${agentEvents[0]!.timestamp}`, 32), spanId: hex(event.id, 16), ...(index ? { parentSpanId: hex(agentEvents[index - 1]!.id, 16) } : {}), name: event.type, kind: 1, startTimeUnixNano: String(BigInt(event.timestamp) * 1_000_000n), endTimeUnixNano: String(BigInt(event.timestamp + 1) * 1_000_000n), attributes: [{ key: "orbi.agent.id", value: { stringValue: agentId } }, { key: "orbi.activity.source", value: { stringValue: event.source } }, ...(event.state ? [{ key: "orbi.activity.state", value: { stringValue: event.state } }] : [])], status: { code: event.state === "failed" ? 2 : 1 } })) }));
  return JSON.stringify({ resourceSpans: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: "OrbiAgents" } }] }, scopeSpans }] }, null, 2);
}

function validateEvent(value: unknown): ActivityEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Activity trace is invalid");
  const event = value as Partial<ActivityEvent>;
  if (typeof event.id !== "string" || !/^[A-Za-z0-9._:-]{1,200}$/.test(event.id) || typeof event.agentId !== "string" || !/^[A-Za-z0-9._-]{1,80}$/.test(event.agentId) || !TYPES.has(String(event.type)) || !SOURCES.has(String(event.source)) || (event.state !== undefined && !STATES.has(String(event.state))) || !Number.isSafeInteger(event.timestamp) || (event.timestamp as number) < 0) throw new Error("Activity trace is invalid");
  return event as ActivityEvent;
}
function hex(value: string, length: number): string { return createHash("sha256").update(value).digest("hex").slice(0, length); }
