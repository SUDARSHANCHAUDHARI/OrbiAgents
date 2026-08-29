import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const HIVE_MESSAGE_KINDS = ["request", "inform", "propose", "query", "agree", "refuse", "done"] as const;
export type HiveMessageKind = (typeof HIVE_MESSAGE_KINDS)[number];
export type HiveMessageStatus = "delivered" | "acknowledged" | "bounced";

export interface HiveMessage {
  id: string;
  senderAgentId: string;
  recipientAgentId: string;
  kind: HiveMessageKind;
  body: string;
  conversationId: string;
  replyToId?: string;
  hopCount: number;
  maxHops: number;
  status: HiveMessageStatus;
  createdAt: number;
  acknowledgedAt?: number;
  bounceReason?: string;
}

export interface SendHiveMessage {
  senderAgentId: string;
  recipientAgentId: string;
  kind: HiveMessageKind;
  body: string;
  conversationId?: string;
  replyToId?: string;
  hopCount?: number;
  maxHops?: number;
}

export class HiveMailbox {
  private eventWrite = Promise.resolve();

  constructor(
    private readonly root: string,
    private readonly recipientExists: (agentId: string) => boolean,
    private readonly wakeRecipient: (agentId: string) => void = () => undefined,
  ) {}

  async send(input: SendHiveMessage): Promise<HiveMessage> {
    const message = this.createMessage(input);
    if (!this.recipientExists(message.recipientAgentId)) {
      message.status = "bounced";
      message.bounceReason = "Recipient does not exist";
    }
    await this.writeMessage("outbox", message.senderAgentId, message);
    if (message.status === "delivered") {
      await this.writeMessage("inbox", message.recipientAgentId, message);
      this.wakeRecipient(message.recipientAgentId);
    }
    await this.appendEvent({ type: message.status === "bounced" ? "message-bounced" : "message-delivered", messageId: message.id, senderAgentId: message.senderAgentId, recipientAgentId: message.recipientAgentId, timestamp: Date.now() });
    return message;
  }

  async acknowledge(recipientAgentId: string, messageId: string): Promise<HiveMessage> {
    const path = this.messagePath("inbox", recipientAgentId, messageId);
    const message = JSON.parse(await readFile(path, "utf8")) as HiveMessage;
    if (message.recipientAgentId !== recipientAgentId) throw new Error("Message recipient mismatch");
    const acknowledged = { ...message, status: "acknowledged" as const, acknowledgedAt: Date.now() };
    await this.writeMessage("inbox", recipientAgentId, acknowledged);
    await this.writeMessage("outbox", message.senderAgentId, acknowledged);
    await this.appendEvent({ type: "message-acknowledged", messageId, senderAgentId: message.senderAgentId, recipientAgentId, timestamp: Date.now() });
    return acknowledged;
  }

  async readInbox(recipientAgentId: string): Promise<HiveMessage[]> {
    const directory = join(this.root, "inbox", safeId(recipientAgentId));
    let files: string[];
    try { files = await readdir(directory); } catch { return []; }
    const messages = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8")) as HiveMessage));
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  }

  private createMessage(input: SendHiveMessage): HiveMessage {
    const sender = safeId(input.senderAgentId);
    const recipient = safeId(input.recipientAgentId);
    if (sender === recipient) throw new Error("Agents cannot message themselves");
    if (!HIVE_MESSAGE_KINDS.includes(input.kind)) throw new Error("Unsupported message kind");
    const body = input.body.trim();
    if (!body || body.length > 10_000) throw new Error("Message body must contain 1 to 10000 characters");
    const hopCount = input.hopCount ?? 0;
    const maxHops = input.maxHops ?? 8;
    if (!Number.isInteger(hopCount) || !Number.isInteger(maxHops) || hopCount < 0 || maxHops < 1 || hopCount > maxHops) throw new Error("Message hop limit exceeded");
    return { id: randomUUID(), senderAgentId: sender, recipientAgentId: recipient, kind: input.kind, body, conversationId: input.conversationId ?? randomUUID(), replyToId: input.replyToId, hopCount, maxHops, status: "delivered", createdAt: Date.now() };
  }

  private async writeMessage(box: "inbox" | "outbox", agentId: string, message: HiveMessage): Promise<void> {
    const path = this.messagePath(box, agentId, message.id);
    await atomicWrite(path, `${JSON.stringify(message, null, 2)}\n`);
  }

  private messagePath(box: "inbox" | "outbox", agentId: string, messageId: string): string {
    return join(this.root, box, safeId(agentId), `${safeId(messageId)}.json`);
  }

  private async appendEvent(event: Record<string, unknown>): Promise<void> {
    this.eventWrite = this.eventWrite.then(async () => {
      const path = join(this.root, "events.jsonl");
      let current = "";
      try { current = await readFile(path, "utf8"); } catch { /* first event */ }
      await atomicWrite(path, `${current}${JSON.stringify(event)}\n`);
    });
    await this.eventWrite;
  }
}

function safeId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) throw new Error("Invalid Hive identifier");
  return normalized;
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}
