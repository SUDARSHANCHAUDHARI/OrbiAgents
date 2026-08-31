import type { ScheduledMission } from "../../../shared/contracts";

export interface MissionOverview { missions: number; enabled: number; pendingRuns: number; enabledEstimateUsd: number; }
export function missionOverview(missions: ScheduledMission[]): MissionOverview { const estimate = missions.filter((mission) => mission.enabled).reduce((total, mission) => total + mission.estimatedCostUsd, 0); return { missions: missions.length, enabled: missions.filter((mission) => mission.enabled).length, pendingRuns: missions.filter((mission) => mission.pendingRunId).length, enabledEstimateUsd: Math.round(estimate * 10_000) / 10_000 }; }

export type MissionStatus = "disabled" | "task-pending" | "approval-requested" | "preparing-approval" | "waiting";
export function missionStatus(mission: ScheduledMission): MissionStatus { if (!mission.enabled) return "disabled"; if (mission.pendingTaskId) return "task-pending"; if (mission.pendingApprovalId) return "approval-requested"; if (mission.pendingRunId) return "preparing-approval"; return "waiting"; }
