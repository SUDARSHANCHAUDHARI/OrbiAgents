import { randomUUID } from "crypto";
import { Agent } from "./types";
import { db } from "./db";
import type { Provider } from "./ai";

export interface SessionFrame {
  timestamp: number;
  agents: Agent[];
}

export interface Session {
  id: string;
  task: string;
  createdAt: number;
  frames: SessionFrame[];
  totalCostUsd: number;
  provider?: Provider;
  shareToken?: string;
  userId?: string;
}

export function canAccessSession(session: Session, userId?: string): boolean {
  return !userId || session.userId === userId;
}

const sessions = new Map<string, Session>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

function serializeSession(session: Session): string {
  return JSON.stringify(session.frames);
}

function deserializeSession(row: {
  id: string;
  task: string;
  frames: string;
  totalCostUsd: number;
  provider: string | null;
  shareToken: string | null;
  userId: string | null;
  createdAt: Date;
}): Session {
  return {
    id: row.id,
    task: row.task,
    createdAt: row.createdAt.getTime(),
    frames: JSON.parse(row.frames) as SessionFrame[],
    totalCostUsd: row.totalCostUsd,
    provider: (row.provider as Provider | null) ?? undefined,
    shareToken: row.shareToken ?? undefined,
    userId: row.userId ?? undefined,
  };
}

function schedulePersist(sessionId: string): void {
  const existing = persistTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    persistTimers.delete(sessionId);
    void persistSession(sessionId);
  }, 50);
  persistTimers.set(sessionId, timer);
}

async function persistSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  await db.storedSession.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      task: session.task,
      frames: serializeSession(session),
      totalCostUsd: session.totalCostUsd,
      provider: session.provider,
      shareToken: session.shareToken,
      userId: session.userId,
      createdAt: new Date(session.createdAt),
    },
    update: {
      task: session.task,
      frames: serializeSession(session),
      totalCostUsd: session.totalCostUsd,
      provider: session.provider,
      shareToken: session.shareToken,
      userId: session.userId,
    },
  });
}

export async function createSession(id: string, task: string, userId?: string, provider?: Provider): Promise<void> {
  const session: Session = {
    id,
    task,
    createdAt: Date.now(),
    frames: [],
    totalCostUsd: 0,
    provider,
    userId,
  };
  sessions.set(id, session);
  await db.storedSession.upsert({
    where: { id },
    create: {
      id,
      task,
      frames: "[]",
      totalCostUsd: 0,
      provider,
      userId,
      createdAt: new Date(session.createdAt),
    },
    update: {
      task,
      frames: "[]",
      totalCostUsd: 0,
      provider,
      shareToken: null,
      userId,
      createdAt: new Date(session.createdAt),
    },
  });
}

export function recordFrame(sessionId: string, agents: Agent[]): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.frames.push({
    timestamp: Date.now(),
    agents: JSON.parse(JSON.stringify(agents)) as Agent[],
  });
  schedulePersist(sessionId);
}

export function updateSessionCost(sessionId: string, costUsd: number): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.totalCostUsd = costUsd;
    schedulePersist(sessionId);
  }
}

export async function getSession(sessionId: string, userId?: string): Promise<Session | null> {
  const inMemory = sessions.get(sessionId);
  if (inMemory) {
    if (!canAccessSession(inMemory, userId)) return null;
    return inMemory;
  }
  const stored = await db.storedSession.findFirst({
    where: userId ? { id: sessionId, userId } : { id: sessionId },
  });
  if (!stored) return null;
  const session = deserializeSession(stored);
  sessions.set(sessionId, session);
  return session;
}

export async function createShareToken(sessionId: string, userId?: string): Promise<string> {
  const session = await getSession(sessionId, userId);
  if (!session) throw new Error("Session not found");

  // Reuse existing token if already shared
  if (session.shareToken) return session.shareToken;

  const token = randomUUID();
  session.shareToken = token;
  await persistSession(sessionId);
  return token;
}

export async function getSessionByShareToken(token: string): Promise<Session | null> {
  for (const session of sessions.values()) {
    if (session.shareToken === token) return session;
  }

  const stored = await db.storedSession.findUnique({ where: { shareToken: token } });
  if (!stored) return null;
  const session = deserializeSession(stored);
  sessions.set(session.id, session);
  return session;
}

export async function listSessions(userId?: string): Promise<Pick<Session, "id" | "task" | "createdAt" | "totalCostUsd" | "provider">[]> {
  const rows = await db.storedSession.findMany({
    where: userId ? { userId } : undefined,
    select: { id: true, task: true, createdAt: true, totalCostUsd: true, provider: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    task: row.task,
    createdAt: row.createdAt.getTime(),
    totalCostUsd: row.totalCostUsd,
    provider: (row.provider as Provider | null) ?? undefined,
  }));
}

export async function getUserSessionUsage(
  userId: string,
  since: Date
): Promise<{ count: number; totalCostUsd: number }> {
  const [count, aggregate] = await Promise.all([
    db.storedSession.count({
      where: {
        userId,
        createdAt: { gte: since },
      },
    }),
    db.storedSession.aggregate({
      _sum: { totalCostUsd: true },
      where: {
        userId,
        createdAt: { gte: since },
      },
    }),
  ]);

  return {
    count,
    totalCostUsd: aggregate._sum.totalCostUsd ?? 0,
  };
}
