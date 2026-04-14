import { randomUUID } from "crypto";
import { Agent } from "./types";

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
  shareToken?: string;
}

const sessions = new Map<string, Session>();
const shareTokens = new Map<string, string>(); // token → sessionId

export function createSession(id: string, task: string): void {
  sessions.set(id, {
    id,
    task,
    createdAt: Date.now(),
    frames: [],
    totalCostUsd: 0,
  });
}

export function recordFrame(sessionId: string, agents: Agent[]): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.frames.push({
    timestamp: Date.now(),
    agents: JSON.parse(JSON.stringify(agents)) as Agent[],
  });
}

export function updateSessionCost(sessionId: string, costUsd: number): void {
  const session = sessions.get(sessionId);
  if (session) session.totalCostUsd = costUsd;
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null;
}

export function createShareToken(sessionId: string): string {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  // Reuse existing token if already shared
  if (session.shareToken) return session.shareToken;

  const token = randomUUID();
  session.shareToken = token;
  shareTokens.set(token, sessionId);
  return token;
}

export function getSessionByShareToken(token: string): Session | null {
  const sessionId = shareTokens.get(token);
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

export function listSessions(): Pick<Session, "id" | "task" | "createdAt" | "totalCostUsd">[] {
  return [...sessions.values()]
    .map(({ id, task, createdAt, totalCostUsd }) => ({ id, task, createdAt, totalCostUsd }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
}
