import { SessionFrame, WorkflowEvent } from "./types";

export function replayDelay(frames: SessionFrame[], currentIndex: number, speed: number): number {
  const current = frames[currentIndex];
  const next = frames[currentIndex + 1];
  if (!current) return 0;
  if (!next) return 900 / Math.max(speed, 0.25);
  return Math.max(100, Math.min(2_000, next.timestamp - current.timestamp)) / Math.max(speed, 0.25);
}

export function eventsThroughFrame(events: WorkflowEvent[], frame?: SessionFrame, finalFrame = false): WorkflowEvent[] {
  if (!frame) return [];
  if (finalFrame) return events;
  return events.filter((event) => event.timestamp <= frame.timestamp);
}
