export type CommandQueueStatus = "queued" | "sending" | "sent" | "failed";
export interface CommandQueueEntry { id: string; agentId: string; body: string; status: CommandQueueStatus; createdAt: number; error?: string; }

const MAX_COMMAND_BYTES = 64 * 1024;
const MAX_SESSION_ENTRIES = 100;

export function createCommandEntry(agentId: string, body: string, createdAt: number, id: string): CommandQueueEntry {
  const command = body.trim();
  if (!command) throw new Error("Command is required");
  if (new TextEncoder().encode(command).byteLength > MAX_COMMAND_BYTES - 1) throw new Error("Command must be smaller than 64 KB");
  return { id, agentId, body: command, status: "queued", createdAt };
}

export function updateCommandEntry(entries: CommandQueueEntry[], id: string, status: CommandQueueStatus, error?: string): CommandQueueEntry[] {
  return entries.map((entry) => entry.id === id ? { ...entry, status, error } : entry).slice(-MAX_SESSION_ENTRIES);
}

export function commandsForAgent(entries: CommandQueueEntry[], agentId: string): CommandQueueEntry[] { return entries.filter((entry) => entry.agentId === agentId); }

export function terminalPayload(entry: CommandQueueEntry): string { return `${entry.body}\r`; }
