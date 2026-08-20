import { SessionFrame, WorkflowEvent } from "./types";

export function replayDelay(frames: SessionFrame[], currentIndex: number, speed: number): number {
  const current = frames[currentIndex];
  const next = frames[currentIndex + 1];
  if (!current || !next) return 0;
  return Math.max(100, Math.min(2_000, next.timestamp - current.timestamp)) / Math.max(speed, 0.25);
}

export function eventsThroughFrame(events: WorkflowEvent[], frame?: SessionFrame): WorkflowEvent[] {
  if (!frame) return [];
  return events.filter((event) => event.timestamp <= frame.timestamp);
}
