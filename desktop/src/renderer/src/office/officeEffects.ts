import type { AgentActivityState } from "../../../shared/contracts";

export interface OfficeEffectPoint { x: number; y: number; }

const ACTIVITY_BUBBLES: Record<AgentActivityState, string> = {
  idle: "STANDBY",
  thinking: "PLAN",
  reading: "READ",
  coding: "CODE",
  "permission-waiting": "APPROVE?",
  done: "DONE",
  failed: "ERROR",
};

export function activityBubbleForState(state: AgentActivityState): string { return ACTIVITY_BUBBLES[state]; }

export function pointOnOfficeLink(from: OfficeEffectPoint, to: OfficeEffectPoint, progress: number): OfficeEffectPoint {
  const bounded = Math.max(0, Math.min(1, progress));
  return { x: from.x + (to.x - from.x) * bounded, y: from.y + (to.y - from.y) * bounded };
}
