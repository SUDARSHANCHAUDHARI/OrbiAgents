import type { CommandHistoryEntry, CommandHistoryStatus } from "../../../shared/contracts";
export type CommandQueueStatus = CommandHistoryStatus;
export type CommandQueueEntry = CommandHistoryEntry;

const MAX_COMMAND_BYTES = 8 * 1024;
const MAX_SESSION_ENTRIES = 100;

export function createCommandEntry(agentId: string, body: string, createdAt: number, id: string, attachments: string[] = []): CommandQueueEntry {
  const command = body.trim();
  if (!command) throw new Error("Command is required");
  if (new TextEncoder().encode(command).byteLength > MAX_COMMAND_BYTES) throw new Error("Command must be no larger than 8 KB");
  if (attachments.length > 5 || new Set(attachments).size !== attachments.length || attachments.some((file) => !safeAttachment(file))) throw new Error("Command attachments are invalid");
  return { id, agentId, body: command, ...(attachments.length ? { attachments: [...attachments] } : {}), status: "queued", createdAt };
}

export function updateCommandEntry(entries: CommandQueueEntry[], id: string, status: CommandQueueStatus, error?: string): CommandQueueEntry[] {
  return entries.map((entry) => entry.id === id ? { ...entry, status, error } : entry).slice(-MAX_SESSION_ENTRIES);
}

export function commandsForAgent(entries: CommandQueueEntry[], agentId: string): CommandQueueEntry[] { return entries.filter((entry) => entry.agentId === agentId); }

export function terminalPayload(entry: CommandQueueEntry): string {
  const files = entry.attachments?.length ? `\n\nAttached workspace files:\n${entry.attachments.map((file) => `- ${JSON.stringify(file)}`).join("\n")}` : "";
  return `${entry.body}${files}\r`;
}
export function isCommandQueueShortcut(event: { key: string; metaKey: boolean; ctrlKey: boolean; isComposing: boolean }): boolean { return event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing; }
function safeAttachment(value: string): boolean { return Boolean(value && value.length <= 1_000 && !value.startsWith("/") && !value.includes("\\") && value.split("/").every((part) => part && part !== "." && part !== "..")); }
