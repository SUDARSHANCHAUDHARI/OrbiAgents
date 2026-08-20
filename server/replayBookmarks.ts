import { db } from "./db";

export function validateReplayBookmarks(frames: unknown, totalFrames: number): number[] {
  if (!Array.isArray(frames) || frames.length > 500) throw new Error("Bookmarks must be an array with at most 500 frames");
  const normalized = [...new Set(frames.map(Number))].sort((a, b) => a - b);
  if (normalized.some((frame) => !Number.isInteger(frame) || frame < 1 || frame > totalFrames)) throw new Error("Bookmark frames must reference an existing replay frame");
  return normalized;
}

export async function listReplayBookmarks(userId: string, sessionId: string): Promise<number[]> {
  const rows = await db.replayBookmark.findMany({ where: { userId, sessionId }, orderBy: { frame: "asc" } });
  return rows.map((row) => row.frame);
}

export async function replaceReplayBookmarks(userId: string, sessionId: string, frames: number[]): Promise<number[]> {
  await db.$transaction([
    db.replayBookmark.deleteMany({ where: { userId, sessionId } }),
    ...frames.map((frame) => db.replayBookmark.create({ data: { userId, sessionId, frame } })),
  ]);
  return frames;
}
