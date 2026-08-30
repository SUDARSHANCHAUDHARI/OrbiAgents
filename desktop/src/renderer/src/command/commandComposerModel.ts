import type { CommandHistoryEntry, CommandHistoryStatus } from "../../../shared/contracts";
export type CommandQueueStatus = CommandHistoryStatus;
export type CommandQueueEntry = CommandHistoryEntry;

const MAX_COMMAND_BYTES = 8 * 1024;
const MAX_SESSION_ENTRIES = 100;

export function createCommandEntry(agentId: string, body: string, createdAt: number, id: string): CommandQueueEntry {
  const command = body.trim();
  if (!command) throw new Error("Command is required");
  if (new TextEncoder().encode(command).byteLength > MAX_COMMAND_BYTES) throw new Error("Command must be no larger than 8 KB");
  return { id, agentId, body: command, status: "queued", createdAt };
}

export function updateCommandEntry(entries: CommandQueueEntry[], id: string, status: CommandQueueStatus, error?: string): CommandQueueEntry[] {
  return entries.map((entry) => entry.id === id ? { ...entry, status, error } : entry).slice(-MAX_SESSION_ENTRIES);
}

export function commandsForAgent(entries: CommandQueueEntry[], agentId: string): CommandQueueEntry[] { return entries.filter((entry) => entry.agentId === agentId); }

export function terminalPayload(entry: CommandQueueEntry): string { return `${entry.body}\r`; }
