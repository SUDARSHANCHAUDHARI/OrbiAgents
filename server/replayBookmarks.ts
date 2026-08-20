import { db } from "./db";

export interface ReplayBookmarkInput { frame: number; label?: string; shared?: boolean }
export function validateReplayBookmarks(frames: unknown, totalFrames: number): ReplayBookmarkInput[] {
  if (!Array.isArray(frames) || frames.length > 500) throw new Error("Bookmarks must be an array with at most 500 frames");
  const normalized = frames.map((value) => typeof value === "number" ? { frame: value } : value as ReplayBookmarkInput);
  if (normalized.some((item) => !item || !Number.isInteger(item.frame) || item.frame < 1 || item.frame > totalFrames || (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 120)) || (item.shared !== undefined && typeof item.shared !== "boolean"))) throw new Error("Bookmarks must reference an existing frame, use labels under 120 characters, and set shared to a boolean");
  return [...new Map(normalized.map((item) => [item.frame, { frame: item.frame, label: item.label?.trim() || undefined, shared: item.shared === true }])).values()].sort((a, b) => a.frame - b.frame);
}

export async function listReplayBookmarks(userId: string, sessionId: string) {
  const rows = await db.replayBookmark.findMany({ where: { userId, sessionId }, orderBy: { frame: "asc" } });
  return rows.map(({ frame, label, shared }) => ({ frame, label: label ?? undefined, shared }));
}

export async function replaceReplayBookmarks(userId: string, sessionId: string, frames: ReplayBookmarkInput[]) {
  await db.$transaction([
    db.replayBookmark.deleteMany({ where: { userId, sessionId } }),
    ...frames.map((item) => db.replayBookmark.create({ data: { userId, sessionId, frame: item.frame, label: item.label, shared: item.shared === true } })),
  ]);
  return frames;
}
export async function upsertReplayBookmark(userId: string, sessionId: string, item: ReplayBookmarkInput) {
  const row = await db.replayBookmark.upsert({ where: { userId_sessionId_frame: { userId, sessionId, frame: item.frame } }, create: { userId, sessionId, frame: item.frame, label: item.label, shared: item.shared === true }, update: { label: item.label, shared: item.shared === true }, select: { frame: true, label: true, shared: true } });
  return { frame: row.frame, label: row.label ?? undefined, shared: row.shared };
}
export async function deleteReplayBookmark(userId: string, sessionId: string, frame: number) { return (await db.replayBookmark.deleteMany({ where: { userId, sessionId, frame } })).count === 1; }
export async function listSharedReplayBookmarks(sessionId: string) { return db.replayBookmark.findMany({ where: { sessionId, shared: true }, orderBy: { frame: "asc" }, select: { frame: true, label: true } }); }
