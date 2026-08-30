import type { ScheduledMission } from "../../../shared/contracts";

export function missionOverview(missions: ScheduledMission[]): string {
  if (!missions.length) return "No scheduled missions";
  const enabled = missions.filter((mission) => mission.enabled).length;
  const pending = missions.filter((mission) => mission.pendingRunId).length;
  const authorizedEstimate = missions.filter((mission) => mission.enabled).reduce((total, mission) => total + mission.estimatedCostUsd, 0);
  return `${missions.length} missions · ${enabled} enabled · ${pending} pending runs · $${authorizedEstimate.toFixed(4)} enabled-run estimate`;
}

export function missionStatus(mission: ScheduledMission): string {
  if (!mission.enabled) return "Disabled — no heartbeat runs";
  if (mission.pendingTaskId) return "Task dispatch pending";
  if (mission.pendingApprovalId) return "Approval requested — execution remains gated";
  if (mission.pendingRunId) return "Preparing approval request";
  return "Enabled — waiting for next heartbeat";
}
