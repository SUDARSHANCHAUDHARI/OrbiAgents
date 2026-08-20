import { db } from "./db";

export interface ReplayBookmarkInput { frame: number; label?: string; shared?: boolean }
export function validateReplayBookmarks(frames: unknown, totalFrames: number): ReplayBookmarkInput[] {
  if (!Array.isArray(frames) || frames.length > 500) throw new Error("Bookmarks must be an array with at most 500 frames");
  const normalized = frames.map((value) => typeof value === "number" ? { frame: value } : value as ReplayBookmarkInput);
  if (normalized.some((item) => !item || !Number.isInteger(item.frame) || item.frame < 1 || item.frame > totalFrames || (item.label !== undefined && (typeof item.label !== "string" || item.label.length > 120)))) throw new Error("Bookmarks must reference an existing frame and use labels under 120 characters");
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
export async function listSharedReplayBookmarks(sessionId: string) { return db.replayBookmark.findMany({ where: { sessionId, shared: true }, orderBy: { frame: "asc" }, select: { frame: true, label: true } }); }
