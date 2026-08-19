import { randomUUID } from "crypto";
import { db } from "./db";

export type MessageKind = "request" | "inform" | "propose" | "query" | "agree" | "refuse" | "done";
const MESSAGE_KINDS = new Set<MessageKind>(["request", "inform", "propose", "query", "agree", "refuse", "done"]);
export const DEFAULT_MAX_MESSAGE_HOPS = 8;

export interface SendMessageInput {
  userId: string;
  projectKey?: string;
  senderAgentId: string;
  recipientAgentId: string;
  kind: MessageKind;
  body: string;
  conversationId?: string;
  replyToId?: string;
  hopCount?: number;
  maxHops?: number;
}

export class MessageHopLimitError extends Error {
  constructor() {
    super("Message hop limit exceeded");
    this.name = "MessageHopLimitError";
  }
}

export function validateMessage(input: SendMessageInput): void {
  const senderAgentId = input.senderAgentId.trim();
  const recipientAgentId = input.recipientAgentId.trim();
  if (!senderAgentId || !recipientAgentId) {
    throw new Error("Sender and recipient are required");
  }
  if (senderAgentId === recipientAgentId) {
    throw new Error("Agents cannot message themselves");
  }
  if (!input.body.trim()) throw new Error("Message body is required");
  if (!MESSAGE_KINDS.has(input.kind)) throw new Error("Unsupported message kind");
  if (input.body.length > 10_000) throw new Error("Message body is too long");
  if ((input.hopCount ?? 0) > (input.maxHops ?? DEFAULT_MAX_MESSAGE_HOPS)) {
    throw new MessageHopLimitError();
  }
}

export async function sendMessage(input: SendMessageInput) {
  const normalized: SendMessageInput = {
    ...input,
    senderAgentId: input.senderAgentId.trim(),
    recipientAgentId: input.recipientAgentId.trim(),
    hopCount: 0,
  };
  if (input.replyToId) {
    const parent = await db.mailboxMessage.findFirst({
      where: { id: input.replyToId, userId: input.userId },
    });
    if (!parent) throw new Error("Reply message not found");
    if (normalized.senderAgentId !== parent.recipientAgentId || normalized.recipientAgentId !== parent.senderAgentId) {
      throw new Error("Reply sender and recipient must match the parent conversation");
    }
    normalized.conversationId = parent.conversationId;
    normalized.hopCount = parent.hopCount + 1;
  }
  validateMessage(normalized);
  return db.mailboxMessage.create({
    data: {
      userId: normalized.userId,
      projectKey: normalized.projectKey?.trim() || "default",
      senderAgentId: normalized.senderAgentId,
      recipientAgentId: normalized.recipientAgentId,
      kind: normalized.kind,
      body: normalized.body.trim(),
      conversationId: normalized.conversationId ?? randomUUID(),
      replyToId: normalized.replyToId,
      hopCount: normalized.hopCount ?? 0,
    },
  });
}

export async function readInbox(
  userId: string,
  recipientAgentId: string,
  options: { projectKey?: string; includeRead?: boolean; limit?: number } = {}
) {
  return db.mailboxMessage.findMany({
    where: {
      userId,
      projectKey: options.projectKey ?? "default",
      recipientAgentId,
      status: options.includeRead ? undefined : "pending",
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(options.limit ?? 50, 1), 200),
  });
}

export async function markMessageRead(userId: string, id: string) {
  const existing = await db.mailboxMessage.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return db.mailboxMessage.update({
    where: { id },
    data: { status: "read", readAt: new Date() },
  });
}
